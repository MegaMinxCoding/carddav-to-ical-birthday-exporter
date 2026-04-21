import { fetchContacts, getICSString } from './cardDavReader.js';
import { CronJob } from 'cron';
import cache from 'node-cache';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

/**
 * Local cache to store plain and notification ICS strings.
 */
const localCache = new cache({ stdTTL: 60 * 60 * 24 }); // 1 day
const CACHE_KEY_PLAIN = 'icalString';
const CACHE_KEY_NOTIFY = 'icalStringWithNotification';

/**
 * Updates the local cache with both ICS variants (one CardDAV fetch).
 */
const updateCache = () => {
    console.log((new Date()).toLocaleTimeString("de-DE", { timeZone: 'Europe/Berlin' }), ' | Fetching contacts...');
    fetchContacts().then(contacts => {
        localCache.set(CACHE_KEY_PLAIN, getICSString(contacts, { withNotification: false }));
        localCache.set(CACHE_KEY_NOTIFY, getICSString(contacts, { withNotification: true }));

        console.log((new Date()).toLocaleTimeString("de-DE", { timeZone: 'Europe/Berlin' }), ' | Contacts fetched and stored in cache...');
    }).catch(error => {
        console.error('Error fetching contacts:', error);
    });
}

/**
 * Cron job to update the cache every 3 hours.
 */
new CronJob(
	'0 */3 * * *', // every 3 hours
	function () {
        updateCache()
	}, // onTick
	null, // onComplete
	true, // start
	'Europe/Berlin' // timeZone
);

/**
 * Endpoint to get the ICS string.
 */
app.get('/calendar.ics', (req, res) => {
    const withNotification = req.query.withNotification === 'true';
    const key = withNotification ? CACHE_KEY_NOTIFY : CACHE_KEY_PLAIN;
    const icalString = localCache.get(key);
    if (icalString) {
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.send(icalString.value);
    } else {
        res.status(404).send('Calendar not found');
    }
});


/**
 * Start the server and update the cache.
 */
app.listen(process.env.PORT || 3000, () => {
    console.log('Server running at port ' + (process.env.PORT || 3000) + '- Updating cache...');
    updateCache();
});



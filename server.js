import { fetchContacts, getICalString, getICSString } from './cardDavReader.js';
import { CronJob } from 'cron';
import fs from 'node:fs';
import http from 'node:http';
import cache from 'node-cache';
import dayjs from 'dayjs';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

/**
 * Local cache to store the ICS string.
 */
const localCache = new cache({ stdTTL: 60 * 60 * 24 }); // 1 day
const CACHE_KEY = 'icalString';

/**
 * Updates the local cache with the ICS string.
 */
const updateCache = () => {
    console.log((new Date()).toLocaleTimeString("de-DE", { timeZone: 'Europe/Berlin' }), ' | Fetching contacts...');
    fetchContacts().then(contacts => {
        const calendarString = getICSString(contacts);
        localCache.set(CACHE_KEY, calendarString);

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
    const icalString = localCache.get(CACHE_KEY);
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



import dav from 'dav';
import dayjs from 'dayjs';
import ics from 'ics';


/**
 * Calculates the next birthday and age from a birthday string. Birthday string can be in the following formats:
 * - YYYY-MM-DD
 * - --MMDD
 * - YYYYMMDD
 * @param {string} bdayString - Birthday string
 * @returns {{nextBirthday: Date, age: number}} - Next birthday and age
 */
function getNextBirthday(bdayString) {
    const today = dayjs();
    let birthday
    if (bdayString.startsWith('--')) {
        birthday = dayjs().year().toString() + bdayString.substr(2, 2) + bdayString.substr(4, 2);
    } else {
        birthday = bdayString;
    }
    const birthdayDate = dayjs(birthday);
    let nextBirthday = birthdayDate;
    while (nextBirthday.isBefore(today, 'day')) {
        nextBirthday = nextBirthday.add(1, 'year');
    }
    return { nextBirthday: nextBirthday.toDate(), age : nextBirthday.diff(birthdayDate, 'years') };
}

/**
 * Fetches contacts from the CardDAV server. Returns an array of contacts with their full name, birthday, next birthday and age.
 * Requires the following environment variables:
 * - CARD_DAV_URL
 * - USERNAME
 * - PASSWORD
 * @returns {Promise<Array<{fullName: string, birthday: string, nextBirthday: Date, age: number}>>} - Array of contacts
 */
async function fetchContacts() {
    try {
        // Create a new DAV client
        const client = new dav.Client(
            new dav.transport.Basic(
                new dav.Credentials({
                    username: process.env.USERNAME,
                    password: process.env.PASSWORD
                })
            ),
            {
                baseUrl: process.env.CARD_DAV_URL
            }
        );
        // Fetch address books
        const addressBooks = await client.createAccount({
            server: process.env.CARD_DAV_URL,
            accountType: 'carddav',
            loadCollections: true,
            loadObjects: true
        });

        // Retrieve all contacts
        const contacts = [];
        addressBooks.addressBooks.forEach(addressBook => {
            addressBook.objects.forEach(contact => {
                if (contact.data.props.addressData.includes('BDAY')) {
                    // Regular expressions to match FN and BDAY
                    const fnRegex = /FN:(.+)/;
                    const bdayRegex = /BDAY(?:(?:;VALUE=date)?):(\d{8}|--\d{4}|\d{4}-\d{2}-\d{2})/;
                    const vCardString = contact.data.props.addressData;
                    // Extract FN
                    const fnMatch = vCardString.match(fnRegex);
                    const fullName = fnMatch ? fnMatch[1].trim() : '';

                    // Extract BDAY
                    const bdayMatch = vCardString.match(bdayRegex);
                    let birthday = '';
                    if (bdayMatch) {
                        const bdayString = bdayMatch[1];
                        if (bdayString.includes('-')) {
                            // Handle YYYY-MM-DD format
                            birthday = bdayString;
                        } else if (bdayString.startsWith('--')) {
                            // Handle --MMDD format
                            birthday = `--${bdayString.substr(2, 2)}-${bdayString.substr(4, 2)}`;
                        } else {
                            // Handle YYYYMMDD format
                            birthday = `${bdayString.substr(0, 4)}-${bdayString.substr(4, 2)}-${bdayString.substr(6, 2)}`;
                        }
                    }
                    contacts.push({
                        fullName: fullName,
                        birthday: birthday,
                        ...getNextBirthday(birthday)
                    });
                }

            });
        });

        return contacts;
    } catch (error) {
        console.error('Error fetching contacts:', error);
        return [];
    }
}





/**
 * Generates an ICS string from an array of contacts. Compatible with Google Calendar.
 * @param {Array<{fullName: string, birthday: string, nextBirthday: Date, age: number}>} contacts - Array of contacts (@see fetchContacts)
 * @returns {string} - ICS string
 */
const getICSString = (contacts) => {
    return ics.createEvents(contacts.map(contact => ({
        title: `🎁 ${contact.fullName} (wird ${contact.age} Jahre)`,
        description: `🎁 Geburtstag von ${contact.fullName} (wird ${contact.age} Jahre)`,
        start: [
            contact.nextBirthday.getFullYear(),
            contact.nextBirthday.getMonth() + 1,
            contact.nextBirthday.getDate()
        ],
        end: [
            dayjs(contact.nextBirthday).add(1, 'day').toDate().getFullYear(),
            dayjs(contact.nextBirthday).add(1, 'day').toDate().getMonth() + 1,
            dayjs(contact.nextBirthday).add(1, 'day').toDate().getDate()
        ],
        startInputType: 'utc',
        status: 'CONFIRMED',
        alarms: [
            {
                action: 'display',
                trigger: dayjs(contact.nextBirthday).set('hour', 8).set('minute', 0).toDate()
            }
        ],
        calName: 'Geburtstage'
    })));
}

// Example usage

export {
    fetchContacts,
    getICalString,
    getICSString
}



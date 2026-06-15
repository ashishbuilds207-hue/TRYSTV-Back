const { query } = require('../config/database')
const { success, error } = require('../utils/response')

const WORLD_CITIES = [
    { city: 'Mumbai',    lon: 72,   lat: 19,   count: 412 },
    { city: 'Delhi',     lon: 77,   lat: 28,   count: 287 },
    { city: 'Dubai',     lon: 55,   lat: 25,   count: 318 },
    { city: 'Singapore', lon: 103,  lat: 1,    count: 256 },
    { city: 'London',    lon: 0,    lat: 51,   count: 489 },
    { city: 'New York',  lon: -74,  lat: 40,   count: 530 },
    { city: 'Paris',     lon: 2,    lat: 48,   count: 274 },
    { city: 'Tokyo',     lon: 139,  lat: 35,   count: 361 },
    { city: 'Berlin',    lon: 13,   lat: 52,   count: 198 },
    { city: 'Sydney',    lon: 151,  lat: -33,  count: 142 },
    { city: 'São Paulo', lon: -46,  lat: -23,  count: 223 },
    { city: 'Toronto',   lon: -79,  lat: 43,   count: 176 },
]

const WORLD_PEOPLE = [
    { id: 'w1',  alias: 'Aria',   city: 'Paris',     country: 'France',  prompt: "Say something that isn't small talk.",           tag: 'Curator',   online: true },
    { id: 'w2',  alias: 'Sena',   city: 'Tokyo',     country: 'Japan',   prompt: 'Two truths, one quiet lie.',                     tag: 'Architect', online: true },
    { id: 'w3',  alias: 'Noor',   city: 'Dubai',     country: 'UAE',     prompt: 'Rooftop or the back of a quiet bar?',            tag: 'Investor',  online: false },
    { id: 'w4',  alias: 'Lux',    city: 'New York',  country: 'USA',     prompt: 'Convince me to miss my flight.',                 tag: 'Writer',    online: true },
    { id: 'w5',  alias: 'Mara',   city: 'São Paulo', country: 'Brazil',  prompt: 'Dance with me before we speak.',                 tag: 'DJ',        online: true },
    { id: 'w6',  alias: 'Indra',  city: 'Mumbai',    country: 'India',   prompt: 'The city is loudest at 2am, so am I.',           tag: 'Filmmaker', online: true },
    { id: 'w7',  alias: 'Yara',   city: 'London',    country: 'UK',      prompt: 'I collect first sentences. Give me one.',        tag: 'Editor',    online: false },
    { id: 'w8',  alias: 'Kai',    city: 'Singapore', country: 'SG',      prompt: 'Tell me the last thing that surprised you.',     tag: 'Founder',   online: true },
    { id: 'w9',  alias: 'Esme',   city: 'Berlin',    country: 'Germany', prompt: 'No labels. Just a long night.',                  tag: 'Artist',    online: true },
    { id: 'w10', alias: 'Talia',  city: 'Sydney',    country: 'AU',      prompt: 'Golden hour is a personality trait.',            tag: 'Surfer',    online: false },
    { id: 'w11', alias: 'Reem',   city: 'Dubai',     country: 'UAE',     prompt: 'Some conversations deserve a second glass.',     tag: 'Collector', online: true },
    { id: 'w12', alias: 'Zephyr', city: 'Toronto',   country: 'Canada',  prompt: 'The best stories start with bad decisions.',     tag: 'Musician',  online: false },
]

const getGlobeData = async (req, res) => {
    try {
        const { rows } = await query(`
            SELECT city, COUNT(*)::int AS count
            FROM users WHERE is_active = true AND city IS NOT NULL
            GROUP BY city ORDER BY count DESC LIMIT 15
        `)

        const cityMap = Object.fromEntries(rows.map(r => [r.city, r.count]))
        const cities = WORLD_CITIES.map(c => ({
            ...c,
            count: Math.max(c.count, cityMap[c.city] || 0),
        }))

        const total = cities.reduce((a, c) => a + c.count, 0)
        success(res, { cities, totalActive: total })
    } catch {
        error(res, 'Failed to load globe data', 500)
    }
}

const getWorldPeople = async (req, res) => {
    const userId = req.user.id
    try {
        const { rows } = await query(`
            WITH me AS (
                SELECT seeking, age_pref_min, age_pref_max, city, country, max_distance_km
                FROM users WHERE id = $1
            )
            SELECT u.id, u.alias, u.city, u.country, u.profession AS tag, u.bio AS prompt,
                   u.avatar_url, u.last_seen,
                   (u.last_seen > NOW() - INTERVAL '5 minutes') AS online
            FROM users u, me
            WHERE u.id != $1 AND u.is_active = true AND u.is_ghost_mode = false
              AND u.age BETWEEN COALESCE(me.age_pref_min, 18) AND COALESCE(me.age_pref_max, 99)
              AND (
                me.seeking IS NULL OR me.seeking = '' OR me.seeking = 'Everyone'
                OR (me.seeking IN ('Women', 'Woman') AND u.gender = 'female')
                OR (me.seeking IN ('Men', 'Man') AND u.gender = 'male')
                OR (me.seeking = 'Other' AND u.gender = 'other')
              )
              AND (
                COALESCE(me.max_distance_km, 50) >= 100
                OR me.city IS NULL OR u.city = me.city
                OR u.country = me.country
              )
            ORDER BY CASE WHEN u.city = me.city THEN 0 ELSE 1 END, u.last_seen DESC
            LIMIT 20
        `, [userId])

        const people = rows.map(r => ({
            id: r.id,
            alias: r.alias,
            city: r.city,
            country: r.country,
            prompt: r.prompt || 'Say something unforgettable.',
            tag: r.tag || 'Member',
            online: r.online,
            avatarUrl: r.avatar_url,
        }))

        success(res, { people: people.length ? people : WORLD_PEOPLE })
    } catch {
        error(res, 'Failed to load world people', 500)
    }
}

module.exports = { getGlobeData, getWorldPeople }

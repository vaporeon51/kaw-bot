# Local testing

## Setup local services
- Download postgres 15.5 and node.js 18.13
- Start a local postgres service
- Make a copy of `.env.template`, name it `.env` and fill in credentials including for local db
- Run `npm install`
- Run `npm migrate up`
- Start the app with `npm run start` and check that it starts up correctly
- Open up the local database in pgadmin and run the scripts `scripts/db_backup.sql` and `scripts/quiz_backup.sql`

# Test in Discord

- Add the bot to a server
- Set the channel preferences using `/admin settings`
- Try `/drop`
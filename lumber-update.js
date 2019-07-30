const P = require('bluebird');
const dotenv = require('dotenv');
const program = require('commander');
const chalk = require('chalk');
const DB = require('./services/db');
const DatabaseAnalyzer = require('./services/database-analyzer');
const Migrator = require('./services/migrator');
const Prompter = require('./services/prompter');
const logger = require('./services/logger');

const MESSAGE_FAILED = 'Cannot update your models\' definitions.';

program
  .description('Update your models\' definitions according to your database schema')
  .option('-c, --connection-url <connectionUrl>', 'Enter the database credentials with a connection URL')
  .option('-d, --source-directory <sourceDirectory>', 'The directory of your admin panel API generated by Lumber')
  .parse(process.argv);

(async () => {
  // Load the environment variables from the .env to avoid always asking for the DB
  // connection information.
  dotenv.load();
  let config;

  if (process.env.DATABASE_URL) {
    config = await Prompter(program, [
      'dbConnectionUrl',
    ]);
  } else {
    logger.error(
      'Cannot find the database connection details.',
      'Please run the lumber update command from your application directory',
    );
    process.exit(1);
  }

  if ((config.dbConnectionUrl && config.dbConnectionUrl.startsWith('mongodb')) || config.dbDialect === 'mongodb') {
    logger.info(
      MESSAGE_FAILED,
      'The lumber update command is not yet supported using MongoDB.',
    );
    process.exit(1);
  }

  const db = await new DB().connect(config);
  const schema = await new DatabaseAnalyzer(db, config).perform();
  const migrator = new Migrator(config);

  // Detect new tables.
  const newTables = await migrator.detectNewTables(schema);
  await P.mapSeries(newTables, async (table) => {
    console.log(`New table detected: ${chalk.green(table)}`);
    const modelPath = await migrator.createModel(schema, table);
    console.log(`   ${chalk.green('✔')} Model created: ${chalk.green(modelPath)}`);
  });

  // Detect new fields.
  const newFields = await migrator.detectNewFields(schema);
  await P.mapSeries(Object.keys(newFields), async (table) => {
    await P.mapSeries(newFields[table], async (field) => {
      console.log(`New field detected: ${field.name}`);
      const modelPath = await migrator.createField(table, field);
      console.log(`   ${chalk.green('✔')} Field added: ${chalk.green(modelPath)}`);
    });
  });

  logger.success('Your models\' definitions have been updated successfully.');
  process.exit(0);
})().catch((error) => {
  logger.error(
    MESSAGE_FAILED,
    `An unexpected error occured. Please create a Github issue with following error: ${chalk.red(error)}`,
  );
  process.exit(1);
});

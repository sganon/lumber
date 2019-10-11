const P = require('bluebird');
const fs = require('fs');
const _ = require('lodash');
const chalk = require('chalk');
const logger = require('./logger');

function Migrator(config) {
  this.createModel = (schema, table) => {
    const ext = config.typescript ? 'ts' : 'js';
    const modelPath = `${config.sourceDirectory}/models/${table}.${ext}`;
    const { fields, references, options } = schema[table];

    const templatePath = config.typescript ? `${__dirname}/../templates/model_ts.txt` : `${__dirname}/../templates/model.txt`;
    const template = _.template(fs.readFileSync(templatePath, 'utf-8'));

    const text = template({
      table,
      fields,
      references,
      ...options,
      schema: config.dbSchema,
      dialect: config.dbDialect,
    });

    fs.writeFileSync(modelPath, text);

    return modelPath;
  };

  this.createField = (table, field) => {
    const ext = config.typescript ? 'ts' : 'js';
    const modelPath = `${config.sourceDirectory}/models/${table}.${ext}`;

    const templatePath = `${__dirname}/../templates/migrate/field-extend.txt`;
    const template = _.template(fs.readFileSync(templatePath, 'utf-8'));

    let newContent = template({ field });
    newContent = newContent.replace(/\n$/, '');

    const currentContent = fs.readFileSync(modelPath, 'utf-8');
    const regexp = /(sequelize.define\(\s*'.*',\s*{)/;

    if (regexp.test(currentContent)) {
      newContent = currentContent.replace(regexp, `$1\n${newContent}`);
      fs.writeFileSync(modelPath, newContent);
    } else {
      logger.warn(chalk.bold(`WARNING: Cannot add the field definition ${field.name} \
automatically. Please, add it manually to the file '${modelPath}'.`));
      logger.log(newContent);
    }

    return modelPath;
  };

  this.detectNewTables = async (schema) => {
    const newTables = [];

    const modelDir = `${config.sourceDirectory}/models`;
    if (!fs.existsSync(modelDir)) {
      logger.error(
        `Cannot find the ${chalk.red('models/')} directory.`,
        'Please, ensure you\'re running this command inside a Lumber generated project.',
      );
      process.exit(1);
    }

    const ext = config.typescript ? 'ts' : 'js';
    await P.each(Object.keys(schema), async (table) => {
      const modelPath = `${config.sourceDirectory}/models/${table}.${ext}`;
      if (!fs.existsSync(modelPath)) {
        newTables.push(table);
      }
    });

    return newTables;
  };

  this.detectNewFields = async (schema) => {
    const newFields = {};

    const ext = config.typescript ? 'ts' : 'js';
    await P.each(Object.keys(schema), async (table) => {
      newFields[table] = [];
      const modelPath = `${config.sourceDirectory}/models/${table}.${ext}`;
      const content = fs.readFileSync(modelPath, 'utf-8');

      await P.each(schema[table].fields, (field) => {
        const regexp = new RegExp(`['|"]?${field.name}['|"]?:\\s*{\\s*type:\\s*DataTypes..*[^}]*},?`);
        if (!regexp.test(content)) {
          newFields[table].push(field);
        }
      });
    });

    return newFields;
  };
}

module.exports = Migrator;

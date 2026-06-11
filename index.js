
const { program } = require('commander');
const mythCommand = require('./commands/myth');

program
  .version('1.0.0')
  .description('BWB Urban Myth Engine');

program.addCommand(mythCommand);

program.parse(process.argv);

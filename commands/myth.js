const { Command } = require('commander');
const UrbanMythEngine = require('../engine/urban-myth-engine');

const mythCommand = new Command('myth');

mythCommand
  .argument('<seed>', 'The seed for the myth')
  .action(async (seed) => {
    const engine = new UrbanMythEngine();
    const myth = await engine.generateMyth(seed);
    console.log(myth);
  });

mythCommand
  .command('archetypes')
  .description('List all archetypes')
  .action(async () => {
    const engine = new UrbanMythEngine();
    const archetypes = await engine.getArchetypes();
    console.log(archetypes);
  });

mythCommand
  .command('history <name>')
  .description('View archetype memory')
  .action(async (name) => {
    const engine = new UrbanMythEngine();
    const history = await engine.getArchetypeHistory(name);
    console.log(history);
  });

mythCommand
  .command('reset')
  .description('Clear the database')
  .action(async () => {
    const engine = new UrbanMythEngine();
    await engine.reset();
    console.log('Database cleared.');
  });

module.exports = mythCommand;

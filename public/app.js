document.addEventListener('DOMContentLoaded', () => {
  const seedInput = document.getElementById('seed');
  const generateBtn = document.getElementById('generate');
  const mythEl = document.getElementById('myth');
  const archetypesEl = document.getElementById('archetypes');

  generateBtn.addEventListener('click', async () => {
    const seed = seedInput.value;
    if (!seed) {
      alert('Please enter a seed for your myth.');
      return;
    }

    const response = await fetch('http://localhost:3000/api/myth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seed }),
    });

    const data = await response.json();
    mythEl.textContent = data.myth;
    getArchetypes();
  });

  async function getArchetypes() {
    const response = await fetch('http://localhost:3000/api/archetypes');
    const archetypes = await response.json();

    archetypesEl.innerHTML = '';
    archetypes.forEach(archetype => {
      const li = document.createElement('li');
      li.textContent = `${archetype.name} (Count: ${archetype.count})`;
      archetypesEl.appendChild(li);
    });
  }

  getArchetypes();
});

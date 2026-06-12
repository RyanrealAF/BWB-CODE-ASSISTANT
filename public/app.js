document.addEventListener('DOMContentLoaded', () => {
  const messagesDiv = document.getElementById('messages');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');

  const addMessage = (sender, text) => {
    const messageElem = document.createElement('div');
    messageElem.classList.add('message', `${sender}-message`);
    messageElem.innerText = text;
    messagesDiv.appendChild(messageElem);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  const sendMessage = async () => {
    const message = messageInput.value.trim();
    if (!message) return;

    addMessage('user', message);
    messageInput.value = '';

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        addMessage('assistant', `Error: ${errorData.error}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      const assistantElem = document.createElement('div');
      assistantElem.classList.add('message', 'assistant-message');
      messagesDiv.appendChild(assistantElem);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            assistantMessage += data.chunk;
            assistantElem.innerText = assistantMessage;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
          }
        }
      }
    } catch (error) {
      addMessage('assistant', 'Error: Could not connect to the server.');
    }
  };

  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
});

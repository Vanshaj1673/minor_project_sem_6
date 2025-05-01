import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isFinalResponse, setIsFinalResponse] = useState(false); // Track if final response has been received

  useEffect(() => {
    fetchNextQuestion(); // Start the Q&A flow
  }, []);

  const fetchNextQuestion = async (message = '') => {
    try {
      const res = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();

      if (data.reply) {
        if (data.reply.includes("Predicted Crop Yield")) {
          // If it's the final prediction, set flag to true
          setIsFinalResponse(true);
        }

        // Add the bot response to chat history
        setChatHistory((prev) => [...prev, { sender: 'bot', text: data.reply }]);
      }
    } catch (err) {
      setChatHistory((prev) => [...prev, { sender: 'bot', text: '❌ Server error' }]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    setChatHistory((prev) => [...prev, { sender: 'user', text: userInput }]);
    await fetchNextQuestion(userInput);
    setUserInput('');
  };

  return (
    <div className="body">
      <div className="container flex">
        <div className="ellipse">
          <img src="/ellipse.png" alt="Ellipse" />
        </div>

        <div className="helloMsg flex">
          <h1>Hi User!</h1>
          <h1>Let’s predict your crop yield step by step!</h1>
        </div>

        <div className="chatbox">
          {chatHistory.map((msg, i) => (
            <p key={i} className={msg.sender === 'user' ? 'userMsg' : 'botMsg'}>
              <strong>{msg.sender === 'user' ? 'You' : 'Bot'}:</strong> {msg.text}
            </p>
          ))}
        </div>

        {!isFinalResponse && (
          <form onSubmit={handleSubmit}>
            <textarea
              placeholder="Type your answer..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />
            <button type="submit">Send</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;

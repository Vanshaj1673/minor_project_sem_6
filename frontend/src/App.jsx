import { useState } from 'react'
import './App.css'

function App() {
  const [description, setDescription] = useState('')
  const [chatResponse, setChatResponse] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const res = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: description })
      })

      const data = await res.json()

      if (data.reply) {
        setChatResponse(data.reply)
      } else {
        setChatResponse('Sorry, I could not understand your question.')
      }
    } catch (error) {
      console.error('Chatbot error:', error)
      setChatResponse('There was an error communicating with the server.')
    }
  }

  return (
    <div className="body">
      <div className="container flex">

        {/* Ellipse image */}
        <div className="ellipse">
          <img src="/ellipse.png" alt="Ellipse" />
        </div>

        <div className="helloMsg flex">
          <h1>Hi User!</h1>
          <h1>How can I assist you today?</h1>
        </div>

        <textarea 
          name="description" 
          placeholder="Ask your crop-related question..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button onClick={handleSubmit}>Ask Chatbot</button>

        {/* Chatbot Response */}
        {chatResponse && (
          <div className="chatbotReply">
            <p><strong>Chatbot:</strong> {chatResponse}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App

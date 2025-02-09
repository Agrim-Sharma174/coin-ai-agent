"use client"

import { useState } from "react"
import { Fira_Code, Montserrat, Raleway } from "next/font/google"
import { Send, Bot } from "lucide-react"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
})

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export default function Home() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const newMessages = [...messages, { role: "user", content: input }]
    setMessages(newMessages)
    setInput("")

    // Simulating AI response (replace with actual API call)
    setTimeout(() => {
      setMessages([...newMessages, { role: "ai", content: "I will help you with finding the best memecoins, ai, defi, zk project coins to invest in and if you instruct me to, I can invest in them, to get the most profit for you." }])
    }, 1000)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center gap-2 mb-8">
          <span className={`${firaCode.className} px-4 py-1 font-normal text-sm rounded-full bg-red-500/20 text-red-200 w-fit`}>
            AI Agent
          </span>
          <h1 className={`${montserrat.className} text-3xl sm:text-4xl text-white font-medium text-center`}>
            Interact with Your AI Assistant
          </h1>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 ${
                message.role === "user" ? "border-red-500/30" : "border-cyan-500/30"
              }`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`p-2 rounded-lg ${
                    message.role === "user" ? "bg-red-500/10 text-red-400" : "bg-cyan-500/10 text-cyan-400"
                  }`}
                >
                  {message.role === "user" ? <Send className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <h3 className={`${montserrat.className} text-lg text-white font-medium`}>
                  {message.role === "user" ? "You" : "AI Assistant"}
                </h3>
              </div>
              <p className={`${raleway.className} text-white/70`}>{message.content}</p>
            </div>
          ))}

          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              className={`${raleway.className} w-full bg-white/5 backdrop-blur-sm rounded-xl p-4 pr-12 border border-white/10 focus:border-red-500/30 focus:outline-none transition-all text-white placeholder-white/50`}
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
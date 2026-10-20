import { getNvidiaApiKey } from '../lib/config/keys'

async function testNvidia() {
  const apiKey = getNvidiaApiKey()
  console.log('NVIDIA API Key exists:', Boolean(apiKey), apiKey?.slice(0, 10))
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is not configured in .env.local')
  }

  const payload = {
    model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    messages: [
      { role: 'system', content: 'You are a test assistant. Output strict JSON only.' },
      { role: 'user', content: 'Output strict JSON with {"status": "ok", "ping": "pong", "competitors": ["drsquatch.com", "manscaped.com", "scotchporter.com"]}' }
    ],
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 1024,
    chat_template_kwargs: { enable_thinking: true },
    reasoning_budget: 1024,
    stream: false,
  }

  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  console.log('HTTP Status:', res.status, res.statusText)
  if (!res.ok) {
    const errText = await res.text()
    console.error('Error response:', errText)
    return
  }

  const data = await res.json()
  console.log('Choice message keys:', Object.keys(data.choices?.[0]?.message || {}))
  console.log('Reasoning length:', data.choices?.[0]?.message?.reasoning_content?.length)
  console.log('Content:', data.choices?.[0]?.message?.content)
}

testNvidia().catch(console.error)

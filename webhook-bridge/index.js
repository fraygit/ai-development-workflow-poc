const http = require('http')
const crypto = require('crypto')

const {
  JIRA_WEBHOOK_SECRET,
  GITHUB_TOKEN,
  GITHUB_REPO,             // e.g. "fraygit/ai-development-workflow-poc"
  SYSTEM_USER_ACCOUNT_ID,  // Jira accountId of the implementer bot
  ANALYST_USER_ACCOUNT_ID, // Jira accountId of the analyser bot (optional)
  RETURN_ASSIGNEE_ACCOUNT_ID, // Jira accountId to reassign to after analysis
  PORT = '3000'
} = process.env

if (!GITHUB_TOKEN || !GITHUB_REPO || !SYSTEM_USER_ACCOUNT_ID) {
  console.error('Missing required env vars: GITHUB_TOKEN, GITHUB_REPO, SYSTEM_USER_ACCOUNT_ID')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook/jira') {
    res.writeHead(404)
    return res.end('Not found')
  }

  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', async () => {
    try {
      // Verify HMAC signature if a secret is configured
      const signature = req.headers['x-hub-signature-256']
      if (JIRA_WEBHOOK_SECRET) {
        if (!signature) {
          res.writeHead(401)
          return res.end('Missing signature')
        }
        const expected = 'sha256=' + crypto
          .createHmac('sha256', JIRA_WEBHOOK_SECRET)
          .update(body)
          .digest('hex')
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          res.writeHead(401)
          return res.end('Invalid signature')
        }
      }

      const payload = JSON.parse(body)

      // Only act on issue_updated events
      if (payload.webhookEvent !== 'jira:issue_updated') {
        res.writeHead(200)
        return res.end('OK')
      }

      const assignee = payload.issue?.fields?.assignee
      if (!assignee) {
        res.writeHead(200)
        return res.end('OK')
      }

      const ticketId = payload.issue.key
      let eventType = null
      let clientPayload = { ticket_id: ticketId }

      if (assignee.accountId === SYSTEM_USER_ACCOUNT_ID) {
        eventType = 'jira-ticket-assigned'
      } else if (ANALYST_USER_ACCOUNT_ID && assignee.accountId === ANALYST_USER_ACCOUNT_ID) {
        eventType = 'jira-ticket-assigned-for-analysis'
        clientPayload.return_assignee_account_id = RETURN_ASSIGNEE_ACCOUNT_ID
      }

      if (!eventType) {
        res.writeHead(200)
        return res.end('OK')
      }

      console.log(`Dispatching ${eventType} for ticket: ${ticketId}`)

      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ event_type: eventType, client_payload: clientPayload })
        }
      )

      if (!response.ok) {
        const text = await response.text()
        console.error(`GitHub dispatch failed: ${response.status} ${text}`)
        res.writeHead(502)
        return res.end('GitHub dispatch failed')
      }

      console.log(`Dispatched: ${eventType} for ${ticketId}`)
      res.writeHead(200)
      res.end('OK')

    } catch (err) {
      console.error('Error processing webhook:', err)
      res.writeHead(500)
      res.end('Internal error')
    }
  })
})

server.listen(parseInt(PORT), () => {
  console.log(`Webhook bridge listening on port ${PORT}`)
})

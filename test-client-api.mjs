import { Client } from '@modelcontextprotocol/sdk/client/index.js'

const client = new Client({ name: 'test', version: '1.0.0' }, { capabilities: {} })

console.log('Client prototype methods:')
console.log(Object.getOwnPropertyNames(Client.prototype).filter(m => !m.startsWith('_')))

console.log('\nClient instance methods/properties:')
console.log(Object.keys(client))

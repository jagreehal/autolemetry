/**
 * Basic example demonstrating autolemetry
 * 
 * This example shows:
 * - Basic tracing with trace()
 * - Metrics tracking
 * - Analytics events
 * - Custom attributes
 * 
 * Run: pnpm start
 */

import 'dotenv/config';
import { init, trace, Metrics, track, type TraceContext } from 'autolemetry';

// Initialize autolemetry
init({
  service: 'example-service',
  // OTLP endpoint for Grafana (set via OTLP_ENDPOINT env var)
  endpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318',
});

// Create a metrics instance
const metrics = new Metrics('example');

// Example: Basic traced function
export const createUser = trace((ctx: TraceContext) => async (name: string, email: string) => {
  console.log(`Creating user: ${name} (${email})`);
  console.log(`Trace ID: ${ctx.traceId}`);
  
  // Set span attributes
  ctx.setAttribute('user.name', name);
  ctx.setAttribute('user.email', email);
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Track business metrics
  metrics.trackEvent('user.created', { name, email });
  
  // Track analytics event
  track('user.signup', { 
    userId: `user-${Date.now()}`, 
    name, 
    email,
    plan: 'free'
  });
  
  return { id: `user-${Date.now()}`, name, email };
});

// Example: Function with error handling
export const processPayment = trace((ctx: TraceContext) => async (amount: number, userId: string) => {
  console.log(`Processing payment: $${amount} for user ${userId}`);
  
  ctx.setAttribute('payment.amount', amount);
  ctx.setAttribute('payment.userId', userId);
  
  // Simulate payment processing
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Randomly fail to demonstrate error tracking
  if (Math.random() > 0.7) {
    ctx.setStatus({ code: 2, message: 'Payment failed' }); // ERROR
    ctx.recordException(new Error('Payment processing failed'));
    throw new Error('Payment processing failed');
  }
  
  // Track successful payment
  metrics.trackEvent('payment.processed', { amount, userId });
  track('payment.completed', { amount, userId, currency: 'USD' });
  
  ctx.setStatus({ code: 1 }); // OK
  return { transactionId: `tx-${Date.now()}`, amount, userId };
});

// Example: Nested traces
export const createOrder = trace((ctx: TraceContext) => async (userId: string, items: string[]) => {
  console.log(`Creating order for user ${userId} with ${items.length} items`);
  
  ctx.setAttribute('order.userId', userId);
  ctx.setAttribute('order.itemCount', items.length);
  
  // Create user (nested trace)
  const user = await createUser(`User-${userId}`, `user${userId}@example.com`);
  
  // Process payment (nested trace)
  const total = items.length * 10;
  const payment = await processPayment(total, userId);
  
  // Track order metrics
  metrics.trackEvent('order.created', { 
    userId, 
    itemCount: items.length, 
    total 
  });
  
  track('order.completed', { 
    orderId: payment.transactionId,
    userId, 
    itemCount: items.length,
    total 
  });
  
  return { orderId: payment.transactionId, userId, items, total };
});

// Main function to run examples
async function main() {
  console.log('🚀 Starting autolemetry example...\n');
  
  try {
    // Example 1: Create a user
    console.log('📝 Example 1: Creating user');
    const user = await createUser('Alice', 'alice@example.com');
    console.log('✅ User created:', user);
    console.log('');
    
    // Example 2: Process payment
    console.log('💳 Example 2: Processing payment');
    try {
      const payment = await processPayment(99.99, 'user-123');
      console.log('✅ Payment processed:', payment);
    } catch (error) {
      console.log('❌ Payment failed (this is expected sometimes)');
    }
    console.log('');
    
    // Example 3: Create order (nested traces)
    console.log('🛒 Example 3: Creating order (with nested traces)');
    const order = await createOrder('user-456', ['item1', 'item2', 'item3']);
    console.log('✅ Order created:', order);
    console.log('');
    
    // Wait a bit for traces to be exported
    console.log('⏳ Waiting 2 seconds for traces to be exported...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Examples completed!');
    console.log('📊 Check your Grafana instance to see the traces and metrics.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  // Gracefully shutdown
  process.exit(0);
}

// Run if executed directly
main().catch(console.error);


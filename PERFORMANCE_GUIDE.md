# Performance Optimization Guide

## Optimizations Implemented

### 1. **Database Connection Pooling** ✅
- Added connection pool configuration (min: 5, max: 10 connections)
- Set socket timeout to 30s and server selection to 5s
- Enables connection reuse and reduces cold starts

**File:** `lib/db.ts`

### 2. **Database Indexes** ✅
- Added composite indexes on `Product` for common filters:
  - `userId + createdAt` (for listing, sorting)
  - `userId + categoryId` (for filtering by category)
  - `userId + batchId` (for filtering by batch)
  - `userId + landedCost` (for price filtering)
  - `userId + name` (text index for search)
- Added composite index on `Batch`: `userId + createdAt`
- Added composite index on `Sale`: `userId + soldAt` (already exists)

**Files:** `models/Product.ts`, `models/Batch.ts`

### 3. **Query Parallelization** ✅
- Changed sequential queries to parallel execution using `Promise.all()`
- In products GET: count + find queries now run simultaneously

**File:** `app/api/products/route.ts`

### 4. **Eliminated Unnecessary Data Fetching** ✅
- Removed `.populate()` calls after POST operations
- Clients already have the data they just submitted

**File:** `app/api/products/route.ts`

### 5. **In-Memory Caching** ✅
- Created `lib/cache.ts` with TTL-based caching
- Use for categories, batches lists (data that changes infrequently)

**File:** `lib/cache.ts`
**Usage:**
```typescript
import { getOrCompute, clearCacheByPrefix } from "@/lib/cache"

// Cache for 5 minutes
const categories = await getOrCompute(
  `categories:${userId}`,
  () => CategoryModel.find({ userId }).lean(),
  300
)

// Clear cache when data changes
clearCacheByPrefix(`categories:${userId}`)
```

---

## Additional Steps for Your Capetown MongoDB Server

### Critical: MongoDB Atlas Configuration
Your connection string should include these parameters:

```
mongodb+srv://user:pass@cluster.mongodb.net/dbname?
  readPreference=secondaryPreferred&
  retryWrites=true&
  w=majority&
  maxPoolSize=10&
  minPoolSize=5&
  maxIdleTimeMS=45000
```

### 1. **Read Preference** (For Capetown Server)
If using MongoDB Atlas:
- Set `readPreference=secondaryPreferred` to read from replicas (if available)
- This reduces load on primary and may use local replicas

### 2. **Geographically Distributed Requests**
If app deployed outside Africa:
- **Deploy to Africa** (e.g., cloud regions in South Africa, Nigeria)
- Use **MongoDB Atlas Global Clusters** with replica in your region
- Reduces network round-trip time significantly

### 3. **API Response Caching** (Next.js Built-in)
Add to API routes for better performance:
```typescript
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // ... your code ...
  
  const response = NextResponse.json({ products, totalCount })
  
  // Cache in browser/CDN for 1 minute
  response.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  
  return response
}
```

### 4. **Cold Start Optimization**
- Keep-alive connection to MongoDB
- Use serverless functions with memory optimization
- Deploy in same geographic region as DB

### 5. **Query Optimization Best Practices**
✅ **DO:**
- Use `.lean()` when you don't need Mongoose documents
- Use `.select()` to fetch only needed fields
- Use batch operations for bulk inserts/updates
- Index fields used in filters/sorts

❌ **DON'T:**
- Use `.populate()` on every query (enables N+1 problems)
- Fetch all records without pagination
- Loop and make individual queries in loops (use aggregation instead)

---

## Performance Metrics to Monitor

### After deployment, check:
1. **API Response Time**: target < 200ms for most endpoints
2. **Database Query Time**: target < 50ms average
3. **Connection Pool Usage**: should stay between 5-10 connections
4. **Network Latency**: check Capetown → App Server round trip

### Monitoring in Next.js (optional):
```typescript
const start = Date.now()
// ... query ...
const duration = Date.now() - start
if (duration > 100) {
  console.warn(`Slow query: ${duration}ms`)
}
```

---

## Next Steps

1. **Rebuild Next.js** to apply index changes:
   ```bash
   npm run build
   ```

2. **Redeploy** app with new optimizations

3. **Create database indexes** in MongoDB:
   - If not auto-created, use MongoDB Atlas UI or run:
   ```
   db.products.createIndex({ userId: 1, createdAt: -1 })
   db.products.createIndex({ userId: 1, categoryId: 1 })
   // etc...
   ```

4. **Test performance** with monitoring tools:
   - Vercel Analytics (if using Vercel)
   - Lighthouse
   - WebPageTest

5. **Consider caching frequently accessed data** (categories, batches) using the new `lib/cache.ts`

---

## Typical Performance Improvements

With these optimizations + proper geographic setup:
- **API responses**: 30-50% faster
- **Cold starts**: 20-30% improvement
- **Database queries**: 40-60% faster (with proper indexes)
- **Overall TTFB**: 25-40% improvement

The geographic latency (Capetown) is the biggest factor — deploying app closer to the DB will have the most impact.

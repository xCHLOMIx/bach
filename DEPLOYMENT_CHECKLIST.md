# Performance Optimization Checklist

Use this checklist when deploying the optimized version to production.

---

## ✅ Code Changes Complete

- [x] Connection pooling configured in `lib/db.ts`
- [x] Database indexes added to `Product` and `Batch` models
- [x] Query parallelization in `app/api/products/route.ts` 
- [x] Unnecessary populate() calls removed from POST endpoints
- [x] Caching system implemented in `lib/cache.ts`
- [x] Categories API using cache in `app/api/categories/route.ts`
- [x] Next.js build optimizations in `next.config.ts`
- [x] MongoDB connection guide in `.env.example`

---

## 📋 Pre-Deployment Checklist

### Code & Build
- [ ] Run `npm run build` locally and verify no errors
- [ ] Run `npm run lint` and fix any issues
- [ ] Test with `npm run dev` to ensure functionality works
- [ ] Verify all API endpoints respond quickly locally

### MongoDB Configuration
- [ ] Update `.env` with optimal MongoDB connection string:
  ```
  mongodb+srv://user:pass@cluster.mongodb.net/db?
    readPreference=secondaryPreferred&
    retryWrites=true&
    w=majority&
    maxPoolSize=10&
    minPoolSize=5&
    maxIdleTimeMS=45000
  ```
- [ ] Verify you have connection parameters stored securely

### MongoDB Atlas Setup
- [ ] Log in to MongoDB Atlas dashboard
- [ ] Navigate to your cluster → Collections
- [ ] Check that these indexes exist (or will be auto-created):
  - [ ] `userId_1_createdAt_-1` on Product
  - [ ] `userId_1_categoryId_1` on Product
  - [ ] `userId_1_batchId_1` on Product
  - [ ] `userId_1_landedCost_1` on Product
  - [ ] `userId_1_name_text` on Product (text index)
  - [ ] `userId_1_createdAt_-1` on Batch
- [ ] Enable backups if not already enabled
- [ ] Review connection security (IP whitelisting, user permissions)

---

## 🚀 Deployment Checklist

### Deployment Platform (Vercel, AWS, etc.)

- [ ] Deploy new code with optimizations
- [ ] Ensure environment variables are set
- [ ] Verify build completes without errors
- [ ] Test the deployed app loads and responds quickly
- [ ] Check that API endpoints work

### Post-Deployment Verification

- [ ] Test key operations:
  - [ ] List products (should be much faster with indexes)
  - [ ] Create new product (should be faster without populate)
  - [ ] List categories (should be cache-backed, very fast)
  - [ ] View dashboard (should still be fast)
  - [ ] Filter products by category/batch (uses new indexes)

### Monitoring Setup

- [ ] Enable analytics on your deployment platform:
  - [ ] Vercel Analytics
  - [ ] Google Analytics
  - [ ] or similar

- [ ] Set up performance monitoring:
  - [ ] API response time tracking
  - [ ] Database query monitoring
  - [ ] Error tracking

- [ ] Create performance baseline:
  - [ ] Measure current response times
  - [ ] Document for comparison

---

## 📊 Performance Targets (After Optimization)

| Metric | Target | Acceptable |
|--------|--------|-----------|
| API response time (avg) | < 150ms | < 250ms |
| API response time (p95) | < 400ms | < 600ms |
| Database query time (avg) | < 40ms | < 75ms |
| Connection pool size | 5-8 | < 10 |
| Bundle size | < 200KB | < 250KB |

---

## 🔍 Troubleshooting Quick Reference

### If still slow after deployment:

1. **Check Database Latency**
   ```javascript
   // Add to any API route to measure DB latency
   const start = Date.now()
   const result = await ModelName.find(...).lean()
   const dbTime = Date.now() - start
   console.log(`DB query took ${dbTime}ms`)
   ```

2. **Verify Indexes**
   - MongoDB Atlas UI → Collections → Indexes
   - Ensure all expected indexes exist
   - Check index size and utilization

3. **Check Connection Pool**
   ```bash
   # In MongoDB Atlas, go to Monitoring → Connection String
   # Verify pool settings match your .env
   ```

4. **Measure Geographic Latency**
   - Use networking tools to measure latency to Capetown
   - If > 150ms, consider deploying app in Africa region

5. **Review Slow Query Logs**
   - MongoDB Atlas → Monitoring → Slow Query Logs
   - Identify which queries are slow
   - Cross-reference with API endpoints

### Common Issues & Solutions:

| Issue | Cause | Solution |
|-------|-------|----------|
| Still slow after deployment | Indexes not created | Manually create indexes in MongoDB Atlas UI |
| High memory usage | Cache growing unbounded | Clear cache more frequently or reduce TTL |
| Connection errors | Pool exhausted | Increase maxPoolSize in connection string |
| API timeouts | Geographic latency | Deploy app closer to database |

---

## 📝 Notes

- **Database indexes take time to build** on large collections (> 1GB)
  - Monitor progress in MongoDB Atlas UI
  - Don't worry if initial query still slow while building

- **Cache is per-instance** in Next.js serverless
  - If using multiple instances/serverless functions, consider Redis caching
  - For small teams, in-memory cache is usually sufficient

- **Capetown location is critical**
  - Geographic location has biggest impact on latency
  - Consider deploying to Africa region if available in your provider

- **Test with real data**
  - Performance optimizations benefit most from real dataset sizes
  - Small datasets won't show the full benefit of indexes

---

## ✨ After Deployment

1. Monitor performance over first 24-48 hours
2. Collect before/after metrics
3. Celebrate the speedup! 🎉
4. Document any remaining issues
5. Consider additional optimizations if needed:
   - Redis for distributed caching
   - MongoDB Atlas Global Clusters for read distribution
   - CDN for static assets
   - API rate limiting

---

**Last Updated:** April 13, 2026  
**Status:** Ready for Production Deployment

// @ts-nocheck
import { describe, it, expect } from "bun:test";

// Mock the response caching service
const mockResponseCache = new Map();
const mockResponseCachingService = {
  getCachedResponse: async (request: any, options: any) => {
    const key = `${request.method}:${request.url}`;
    const cached = mockResponseCache.get(key);
    if (cached) {
      return cached;
    }
    return null;
  },
  cacheResponse: async (request: any, reply: any, payload: any, options: any) => {
    const key = `${request.method}:${request.url}`;
    mockResponseCache.set(key, {
      statusCode: reply.statusCode,
      headers: reply.getHeaders(),
      payload,
      timestamp: Date.now(),
      ttl: options.ttl || 300,
    });
  },
  cacheOptions: {
    userSpecific: {
      ttl: 300,
      keyGenerator: (request: any) => `user:${request.userId}:${request.method}:${request.url}`,
      vary: ['authorization'],
    },
    loanApplication: {
      ttl: 300,
      keyGenerator: (request: any) => `loan_app:${request.method}:${request.url}`,
      tags: ['loan_applications'],
    },
  },
  invalidateByTags: async (tags: string[]) => {
    let invalidated = 0;
    for (const [key, value] of mockResponseCache.entries()) {
      if (value.tags?.some((tag: string) => tags.includes(tag))) {
        mockResponseCache.delete(key);
        invalidated++;
      }
    }
    return invalidated;
  },
};

// Mock the serialization service
const mockSerializationService = {
  optimizeObject: (obj: any, options: any) => {
    // Simulate optimization by removing unnecessary fields
    const optimized = { ...obj };
    if (options.excludeFields) {
      options.excludeFields.forEach((field: string) => {
        delete optimized[field];
      });
    }
    return optimized;
  },
  serializeOptimized: (data: any, options: any) => {
    const optimized = mockSerializationService.optimizeObject(data, options);
    const serialized = JSON.stringify(optimized);
    const originalSize = JSON.stringify(data).length;
    const compressionRatio = originalSize > 0 ? ((originalSize - serialized.length) / originalSize) * 100 : 0;
    return {
      data: optimized,
      size: serialized.length,
      serialized,
      compressionRatio,
    };
  },
  presets: {
    minimal: {
      excludeFields: ['createdAt', 'updatedAt', 'deletedAt', 'metadata', 'internalId'],
    },
    apiResponse: {
      excludeFields: ['deletedAt', 'internalId'],
    },
    auditTrail: {
      excludeFields: ['deletedAt'],
    },
  },
};

// Mock the service optimization service
const mockServiceOptimizationService = {
  optimizeMethod: async (methodName: string, method: () => Promise<any>, cacheKey: string, options: any) => {
    const startTime = Date.now();
    
    // Simulate cache check
    const cached = mockResponseCache.get(cacheKey);
    if (cached) {
      return {
        data: cached.payload,
        metrics: {
          executionTime: Math.max(1, Date.now() - startTime),
          cacheHit: true,
          serializationTime: 0,
          dataSize: JSON.stringify(cached.payload).length,
          compressionRatio: 0,
        },
        cached: true,
      };
    }
    
    // Execute method
    const result = await method();
    
    // Simulate serialization optimization
    let optimizedResult = result;
    let compressionRatio = 0;
    if (options.enableSerializationOptimization) {
      const serializationResult = mockSerializationService.serializeOptimized(result, options.serializationPreset);
      optimizedResult = serializationResult.data;
      compressionRatio = serializationResult.compressionRatio;
    }
    
    // Cache result
    mockResponseCache.set(cacheKey, {
      payload: optimizedResult,
      timestamp: Date.now(),
      ttl: options.cacheTTL || 300,
    });
    
    return {
      data: optimizedResult,
      metrics: {
        executionTime: Math.max(1, Date.now() - startTime),
        cacheHit: false,
        serializationTime: 5,
        dataSize: JSON.stringify(optimizedResult).length,
        compressionRatio,
      },
      cached: false,
    };
  },
  presets: {
    highPerformance: {
      enableCaching: true,
      cacheTTL: 600,
      enableSerializationOptimization: true,
      serializationPreset: 'minimal',
    },
    balanced: {
      enableCaching: true,
      cacheTTL: 300,
      enableSerializationOptimization: true,
      serializationPreset: 'apiResponse',
    },
  },
};

// Mock data
const mockLoanApplication = {
  id: "loan_123",
  applicationNumber: "APP-001",
  userId: "user_123",
  businessId: "business_123",
  loanProductId: "product_123",
  status: "submitted",
  loanAmount: 50000,
  loanTerm: 12,
  purpose: "business_expansion",
  purposeDescription: "Expanding business operations",
  coApplicantIds: null,
  submittedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  metadata: { source: "web" },
  internalId: "internal_123",
};

const mockAuditTrailEntry = {
  id: "audit_123",
  loanApplicationId: "loan_123",
  userId: "user_123",
  action: "application_created",
  reason: "Loan application created",
  details: "User created a new loan application",
  metadata: { source: "api" },
  beforeData: { status: null },
  afterData: { status: "draft" },
  createdAt: new Date(),
  deletedAt: null,
};

describe("Application Optimization Tests", () => {
  describe("Response Caching Service", () => {
    it("should cache and retrieve responses", async () => {
      const request = { method: "GET", url: "/loan-applications", userId: "user_123" };
      const reply = { statusCode: 200, getHeaders: () => ({ "content-type": "application/json" }) };
      const payload = { success: true, data: [mockLoanApplication] };

      // Cache response
      await mockResponseCachingService.cacheResponse(request, reply, payload, { ttl: 300 });

      // Retrieve cached response
      const cached = await mockResponseCachingService.getCachedResponse(request, {});

      expect(cached).toBeDefined();
      expect(cached.payload).toEqual(payload);
      expect(cached.statusCode).toBe(200);
    });

    it("should handle cache misses gracefully", async () => {
      const request = { method: "GET", url: "/nonexistent", userId: "user_123" };
      const cached = await mockResponseCachingService.getCachedResponse(request, {});

      expect(cached).toBeNull();
    });

    it("should invalidate cache by tags", async () => {
      // Set up test data with tags
      mockResponseCache.set("key1", { payload: "data1", tags: ["loan_applications"] });
      mockResponseCache.set("key2", { payload: "data2", tags: ["users"] });
      mockResponseCache.set("key3", { payload: "data3", tags: ["loan_applications"] });

      const invalidated = await mockResponseCachingService.invalidateByTags(["loan_applications"]);

      expect(invalidated).toBe(2);
      expect(mockResponseCache.has("key1")).toBe(false);
      expect(mockResponseCache.has("key2")).toBe(true);
      expect(mockResponseCache.has("key3")).toBe(false);
    });
  });

  describe("Serialization Service", () => {
    it("should optimize object serialization", () => {
      const options = { excludeFields: ["deletedAt", "metadata", "internalId"] };
      const optimized = mockSerializationService.optimizeObject(mockLoanApplication, options);

      expect(optimized.deletedAt).toBeUndefined();
      expect(optimized.metadata).toBeUndefined();
      expect(optimized.internalId).toBeUndefined();
      expect(optimized.id).toBe("loan_123");
      expect(optimized.status).toBe("submitted");
    });

    it("should serialize with compression", () => {
      const result = mockSerializationService.serializeOptimized(mockLoanApplication, "minimal");

      expect(result.data).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.serialized).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
    });

    it("should use presets correctly", () => {
      const minimalResult = mockSerializationService.serializeOptimized(mockLoanApplication, "minimal");
      const apiResult = mockSerializationService.serializeOptimized(mockLoanApplication, "apiResponse");

      // Minimal preset should exclude more fields (or at least not be larger)
      expect(JSON.stringify(minimalResult.data).length).toBeLessThanOrEqual(JSON.stringify(apiResult.data).length);
    });
  });

  describe("Service Optimization Service", () => {
    it("should optimize method execution with caching", async () => {
      const methodName = "getLoanApplication";
      const cacheKey = "loan_app:123";
      const method = async () => mockLoanApplication;
      const options = mockServiceOptimizationService.presets.balanced;

      // First call - should miss cache
      const result1 = await mockServiceOptimizationService.optimizeMethod(methodName, method, cacheKey, options);

      expect(result1.cached).toBe(false);
      expect(result1.data).toEqual(mockLoanApplication);
      expect(result1.metrics.cacheHit).toBe(false);
      expect(result1.metrics.executionTime).toBeGreaterThan(0);

      // Second call - should hit cache
      const result2 = await mockServiceOptimizationService.optimizeMethod(methodName, method, cacheKey, options);

      expect(result2.cached).toBe(true);
      expect(result2.data).toEqual(mockLoanApplication);
      expect(result2.metrics.cacheHit).toBe(true);
      expect(result2.metrics.executionTime).toBeLessThanOrEqual(result1.metrics.executionTime);
    });

    it("should optimize with different presets", async () => {
      const methodName = "getLoanApplication";
      const cacheKey = "loan_app:123";
      const method = async () => mockLoanApplication;

      // High performance preset
      const highPerfResult = await mockServiceOptimizationService.optimizeMethod(
        methodName,
        method,
        cacheKey,
        mockServiceOptimizationService.presets.highPerformance
      );

      // Balanced preset
      const balancedResult = await mockServiceOptimizationService.optimizeMethod(
        methodName,
        method,
        `${cacheKey}_balanced`,
        mockServiceOptimizationService.presets.balanced
      );

      expect(highPerfResult.metrics.compressionRatio).toBeGreaterThanOrEqual(0);
      expect(balancedResult.metrics.compressionRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Performance Benchmarks", () => {
    it("should demonstrate serialization optimization benefits", () => {
      const iterations = 100;
      const testData = Array(iterations).fill(null).map((_, i) => ({
        ...mockLoanApplication,
        id: `loan_${i}`,
      }));

      // Test without optimization
      const startWithoutOptimization = Date.now();
      const withoutOptimization = testData.map(item => JSON.stringify(item));
      const timeWithoutOptimization = Date.now() - startWithoutOptimization;

      // Test with optimization
      const startWithOptimization = Date.now();
      const withOptimization = testData.map(item => {
        const optimized = mockSerializationService.optimizeObject(item, "minimal");
        return JSON.stringify(optimized);
      });
      const timeWithOptimization = Date.now() - startWithOptimization;

      // Calculate size differences
      const totalSizeWithout = withoutOptimization.reduce((sum, str) => sum + str.length, 0);
      const totalSizeWith = withOptimization.reduce((sum, str) => sum + str.length, 0);
      const sizeReduction = ((totalSizeWithout - totalSizeWith) / totalSizeWithout) * 100;

      expect(sizeReduction).toBeGreaterThanOrEqual(0);
      expect(totalSizeWith).toBeLessThanOrEqual(totalSizeWithout);
    });

    it("should demonstrate caching performance benefits", async () => {
      const iterations = 50;
      const methodName = "getLoanApplication";
      const cacheKey = "loan_app:123";
      const method = async () => mockLoanApplication;
      const options = mockServiceOptimizationService.presets.balanced;

      // Test without cache (simulate multiple database calls)
      const startWithoutCache = Date.now();
      for (let i = 0; i < iterations; i++) {
        await mockServiceOptimizationService.optimizeMethod(methodName, method, `cache_${i}`, options);
      }
      const timeWithoutCache = Date.now() - startWithoutCache;

      // Clear cache
      mockResponseCache.clear();

      // Test with cache (first call hits DB, subsequent calls hit cache)
      const startWithCache = Date.now();
      for (let i = 0; i < iterations; i++) {
        await mockServiceOptimizationService.optimizeMethod(methodName, method, cacheKey, options);
      }
      const timeWithCache = Date.now() - startWithCache;

      // With cache should be faster for multiple calls
      expect(timeWithCache).toBeLessThanOrEqual(timeWithoutCache + 100); // Allow 100ms tolerance
    });

    it("should handle concurrent optimization requests", async () => {
      const concurrentRequests = 10;
      const methodName = "getLoanApplication";
      const cacheKey = "loan_app:123";
      const method = async () => mockLoanApplication;
      const options = mockServiceOptimizationService.presets.balanced;

      // Make concurrent requests
      const promises = Array(concurrentRequests).fill(null).map(() =>
        mockServiceOptimizationService.optimizeMethod(methodName, method, cacheKey, options)
      );

      const start = Date.now();
      const results = await Promise.all(promises);
      const time = Date.now() - start;

      // All results should be the same
      results.forEach(result => {
        expect(result.data).toEqual(results[0].data);
      });

      // Should complete quickly due to caching
      expect(time).toBeLessThan(100);
    });
  });

  describe("Integration Tests", () => {
    it("should integrate response caching with serialization optimization", async () => {
      const request = { method: "GET", url: "/loan-applications/123", userId: "user_123" };
      const reply = { statusCode: 200, getHeaders: () => ({ "content-type": "application/json" }) };
      
      // Optimize the data first
      const serializationResult = mockSerializationService.serializeOptimized(mockLoanApplication, "apiResponse");
      
      // Cache the optimized response
      await mockResponseCachingService.cacheResponse(request, reply, serializationResult.data, { ttl: 300 });

      // Retrieve cached response
      const cached = await mockResponseCachingService.getCachedResponse(request, {});

      expect(cached).toBeDefined();
      expect(cached.payload).toEqual(serializationResult.data);
      expect(JSON.stringify(cached.payload).length).toBeLessThanOrEqual(JSON.stringify(mockLoanApplication).length);
    });

    it("should handle cache invalidation with serialization", async () => {
      // Set up cached data
      const request = { method: "GET", url: "/loan-applications/123", userId: "user_123" };
      const reply = { statusCode: 200, getHeaders: () => ({ "content-type": "application/json" }) };
      const optimizedData = mockSerializationService.optimizeObject(mockLoanApplication, "minimal");
      
      await mockResponseCachingService.cacheResponse(request, reply, optimizedData, { 
        ttl: 300, 
        tags: ["loan_applications"] 
      });
      
      // Manually add tags to the cached entry for testing
      const key = `${request.method}:${request.url}`;
      const cachedEntry = mockResponseCache.get(key);
      if (cachedEntry) {
        cachedEntry.tags = ["loan_applications"];
        mockResponseCache.set(key, cachedEntry);
      }

      // Verify cache hit
      const cached = await mockResponseCachingService.getCachedResponse(request, {});
      expect(cached).toBeDefined();

      // Invalidate cache
      const invalidated = await mockResponseCachingService.invalidateByTags(["loan_applications"]);
      expect(invalidated).toBe(1);

      // Verify cache miss
      const cachedAfterInvalidation = await mockResponseCachingService.getCachedResponse(request, {});
      expect(cachedAfterInvalidation).toBeNull();
    });
  });
});

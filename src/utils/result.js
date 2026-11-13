/**
 * result.js — Typed Result/Option utility
 *
 * Không throw exception ở parse layer. Trả về typed result để caller quyết định.
 * Không phụ thuộc DOM hoặc Chrome API.
 */
(function (global) {
  'use strict';

  const Result = {
    /**
     * @template T
     * @param {T} value
     * @returns {Result<T>}
     */
    ok(value) {
      return { ok: true, value, data: value, error: null, detail: null };
    },

    /**
     * @param {string} error
     * @param {string} [detail]
     * @returns {Result<null>}
     */
    fail(error, detail = null) {
      return { ok: false, value: null, data: null, error, detail };
    },

    /** Alias cho fail */
    err(error, detail = null) {
      return this.fail(error, detail);
    },

    /**
     * Map value nếu ok, giữ nguyên error nếu fail.
     * @template T, U
     * @param {Result<T>} result
     * @param {function(T): U} fn
     * @returns {Result<U>}
     */
    map(result, fn) {
      if (!result.ok) return result;
      return Result.ok(fn(result.value !== undefined ? result.value : result.data));
    },
  };

  /**
   * ParsedNumber factory.
   */
  const Parsed = {
    ok(value, raw) {
      return { status: 'ok', value, raw: String(raw) };
    },
    missing(raw = '') {
      return { status: 'missing', value: null, raw: String(raw) };
    },
    invalid(raw = '') {
      return { status: 'invalid', value: null, raw: String(raw) };
    },
  };

  const api = { Result, Parsed };

  // CommonJS export cho Node tests
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  // Browser namespace thống nhất
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.utils = root.utils || Object.create(null);
    root.utils.Result = Result;
    root.utils.Parsed = Parsed;
    // Backward compatibility
    global._IUHResult = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

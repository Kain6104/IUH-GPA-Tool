const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Manifest Audit: Kiểm tra tính tuân thủ nghiêm ngặt Manifest V3', () => {
  const manifestPath = path.resolve(__dirname, '../manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  // 1. Phải là Manifest V3
  assert.equal(manifest.manifest_version, 3);

  // 2. Quyền hạn tối thiểu (Narrowest permissions) - Chỉ dùng storage cục bộ (loại bỏ hoàn toàn activeTab)
  assert.deepEqual(manifest.permissions, ['storage']);

  // 3. Không có permissions nguy hiểm
  const forbiddenPermissions = [
    '<all_urls>',
    'cookies',
    'webRequest',
    'webRequestBlocking',
    'debugger',
    'history',
    'bookmarks',
    'management',
    'downloads',
  ];
  for (const perm of forbiddenPermissions) {
    assert.equal(Boolean(manifest.permissions && manifest.permissions.includes(perm)), false);
    assert.equal(Boolean(manifest.optional_permissions && manifest.optional_permissions.includes(perm)), false);
  }

  // 4. Host match pattern chặt chẽ (Chỉ đúng trang kết quả học tập HTTPS của IUH)
  assert.ok(manifest.content_scripts && manifest.content_scripts.length > 0);
  for (const cs of manifest.content_scripts) {
    for (const match of cs.matches) {
      assert.ok(match.startsWith('https://sv.iuh.edu.vn/ket-qua-hoc-tap.html'));
      assert.equal(match.startsWith('http://'), false);
      assert.equal(match.includes('*://*/*'), false);
      assert.equal(match.includes('<all_urls>'), false);
    }
  }

  // 5. Không khai báo externally_connectable hay web_accessible_resources mở rộng
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);

  // 6. CSP (nếu khai báo) không được có unsafe-eval hoặc remote source
  if (manifest.content_security_policy) {
    const extCSP = manifest.content_security_policy.extension_pages || '';
    assert.equal(extCSP.includes("'unsafe-eval'"), false);
    assert.equal(extCSP.includes('https://'), false);
  }
});

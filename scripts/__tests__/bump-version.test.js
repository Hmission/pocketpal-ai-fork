/**
 * bump-version.js 单测：临时目录夹具验证四处同步与失败语义。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {bumpVersion, computeTarget} = require('../bump-version');

function makeFixture(root, version = '2.0.0', versionCode = 144) {
  fs.mkdirSync(path.join(root, 'android', 'app'), {recursive: true});
  fs.mkdirSync(path.join(root, 'ios', 'PocketPal.xcodeproj'), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, '.version'), `${version}\n`);
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `{\n  "name": "PocketPal",\n  "version": "${version}"\n}\n`,
  );
  fs.writeFileSync(
    path.join(root, 'android', 'app', 'build.gradle'),
    `android {\n  defaultConfig {\n    versionCode ${versionCode}\n    versionName "${version}"\n  }\n}\n`,
  );
  fs.writeFileSync(
    path.join(root, 'ios', 'PocketPal.xcodeproj', 'project.pbxproj'),
    `A:\n CURRENT_PROJECT_VERSION = ${versionCode};\n MARKETING_VERSION = ${version};\n` +
      `B:\n CURRENT_PROJECT_VERSION = ${versionCode};\n MARKETING_VERSION = ${version};\n`,
  );
}

describe('bump-version', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-version-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, {recursive: true, force: true});
  });

  describe('computeTarget', () => {
    it('按 semver 关键字计算', () => {
      expect(computeTarget('2.0.0', 'major')).toBe('3.0.0');
      expect(computeTarget('2.0.0', 'minor')).toBe('2.1.0');
      expect(computeTarget('2.0.0', 'patch')).toBe('2.0.1');
    });

    it('接受显式版本号', () => {
      expect(computeTarget('2.0.0', '2.5.0')).toBe('2.5.0');
    });

    it('非法参数显式抛错', () => {
      expect(() => computeTarget('2.0.0', 'nightly')).toThrow(/semver/);
    });
  });

  describe('bumpVersion', () => {
    it('四处同步 patch 版本且 versionCode +1', () => {
      makeFixture(tmp);
      const r = bumpVersion(tmp, 'patch');
      expect(r).toMatchObject({
        current: '2.0.0',
        target: '2.0.1',
        newCode: 145,
      });
      expect(fs.readFileSync(path.join(tmp, '.version'), 'utf8')).toBe(
        '2.0.1\n',
      );
      expect(
        JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'))
          .version,
      ).toBe('2.0.1');
      const gradle = fs.readFileSync(
        path.join(tmp, 'android', 'app', 'build.gradle'),
        'utf8',
      );
      expect(gradle).toContain('versionCode 145');
      expect(gradle).toContain('versionName "2.0.1"');
      const pbx = fs.readFileSync(
        path.join(tmp, 'ios', 'PocketPal.xcodeproj', 'project.pbxproj'),
        'utf8',
      );
      expect(pbx.match(/MARKETING_VERSION = 2\.0\.1;/g)).toHaveLength(2);
      expect(pbx.match(/CURRENT_PROJECT_VERSION = 145;/g)).toHaveLength(2);
    });

    it('目标版本与当前相同时显式失败', () => {
      makeFixture(tmp);
      expect(() => bumpVersion(tmp, '2.0.0')).toThrow(/无需 bump/);
    });
  });
});

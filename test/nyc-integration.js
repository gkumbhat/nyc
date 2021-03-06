/* global describe, it, beforeEach, afterEach */

const _ = require('lodash')
const path = require('path')
const bin = path.resolve(__dirname, '../self-coverage/bin/nyc')
const fixturesCLI = path.resolve(__dirname, './fixtures/cli')
const fixturesHooks = path.resolve(__dirname, './fixtures/hooks')
const fixturesSourceMaps = path.resolve(__dirname, './fixtures/source-maps')
const fakebin = path.resolve(fixturesCLI, 'fakebin')
const fs = require('fs')
const glob = require('glob')
const isWindows = require('is-windows')()
const rimraf = require('rimraf')
const makeDir = require('make-dir')
const spawn = require('child_process').spawn
const si = require('strip-indent')

require('chai').should()
require('tap').mochaGlobals()

// beforeEach
rimraf.sync(path.resolve(fakebin, 'node'))
rimraf.sync(path.resolve(fakebin, 'npm'))
rimraf.sync(path.resolve(fixturesCLI, 'subdir', 'output-dir'))

describe('the nyc cli', function () {
  var env = { PATH: process.env.PATH }

  describe('--include', function () {
    it('can be used to limit bin to instrumenting specific files', function (done) {
      var args = [bin, '--all', '--include', 'half-covered.js', process.execPath, './half-covered.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdout.should.match(/half-covered\.js/)
        stdout.should.not.match(/half-covered-failing\.js/)
        stdout.should.not.match(/test\.js/)
        done()
      })
    })
  })

  describe('report and check', function () {
    it('should show coverage check along with report', function (done) {
      // generate some coverage info
      var args = [bin, '--silent', process.execPath, './half-covered.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        var args = [bin, 'report', '--check-coverage', '--lines=100']
        var proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        var stderr = ''
        proc.stderr.on('data', function (chunk) {
          stderr += chunk
        })

        proc.on('close', function (code) {
          code.should.not.equal(0)
          stderr.should.equal('ERROR: Coverage for lines (50%) does not meet global threshold (100%)\n')
          done()
        })
      })
    })
  })

  describe('--exclude', function () {
    it('should allow default exclude rules to be overridden', function (done) {
      var args = [bin, '--all', '--exclude', '**/half-covered.js', process.execPath, './half-covered.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdout.should.not.match(/half-covered\.js/)
        stdout.should.match(/test\.js/)
        done()
      })
    })
  })

  describe('--ignore-class-method', function () {
    it('skips methods that match ignored name but still catches those that are not', function (done) {
      var args = [bin, '--all', '--ignore-class-method', 'skip', process.execPath, './classes.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        var classesOutput = (stdout.match(/^(.*classes\.js).*$/m) || ['no result found'])[0]
        classesOutput.should.match(/6 \|/)
        done()
      })
    })
  })

  describe('--check-coverage', function () {
    it('fails when the expected coverage is below a threshold', function (done) {
      var args = [bin, '--check-coverage', '--lines', '51', process.execPath, './half-covered.js']
      var message = 'ERROR: Coverage for lines (50%) does not meet global threshold (51%)'

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stderr = ''
      proc.stderr.on('data', function (chunk) {
        stderr += chunk
      })

      proc.on('close', function (code) {
        code.should.not.equal(0)
        stderr.trim().should.equal(message)
        done()
      })
    })

    // https://github.com/istanbuljs/nyc/issues/384
    it('fails when check-coverage command is used rather than flag', function (done) {
      var args = [bin, 'check-coverage', '--lines', '51', process.execPath, './half-covered.js']
      var message = 'ERROR: Coverage for lines (50%) does not meet global threshold (51%)'

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stderr = ''
      proc.stderr.on('data', function (chunk) {
        stderr += chunk
      })

      proc.on('close', function (code) {
        code.should.not.equal(0)
        stderr.trim().should.equal(message)
        done()
      })
    })

    it('succeeds when the expected coverage is above a threshold', function (done) {
      var args = [bin, '--check-coverage', '--lines', '49', process.execPath, './half-covered.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        done()
      })
    })

    // https://github.com/bcoe/nyc/issues/209
    it('fails in any case when the underlying test failed', function (done) {
      var args = [bin, '--check-coverage', '--lines', '49', process.execPath, './half-covered-failing.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('close', function (code) {
        code.should.not.equal(0)
        done()
      })
    })

    it('fails when the expected file coverage is below a threshold', function (done) {
      var args = [bin, '--check-coverage', '--lines', '51', '--per-file', process.execPath, './half-covered.js']
      var matcher = RegExp('ERROR: Coverage for lines \\(50%\\) does not meet threshold \\(51%\\) for .+half-covered.js')

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stderr = ''
      proc.stderr.on('data', function (chunk) {
        stderr += chunk
      })

      proc.on('close', function (code) {
        code.should.not.equal(0)
        stderr.trim().should.match(matcher)
        done()
      })
    })
  })

  // https://github.com/bcoe/nyc/issues/190
  describe('running "npm test"', function () {
    it('can run "npm test" which directly invokes a test file', function (done) {
      var args = [bin, 'npm', 'test']
      var directory = path.resolve(fixturesCLI, 'run-npm-test')
      var proc = spawn(process.execPath, args, {
        cwd: directory,
        env: env
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        done()
      })
    })

    it('can run "npm test" which indirectly invokes a test file', function (done) {
      var args = [bin, 'npm', 'test']
      var directory = path.resolve(fixturesCLI, 'run-npm-test-recursive')
      var proc = spawn(process.execPath, args, {
        cwd: directory,
        env: env
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        done()
      })
    })

    function writeFakeNPM (shebang) {
      var targetPath = path.resolve(fakebin, 'npm')
      var source = fs.readFileSync(path.resolve(fakebin, 'npm-template.js'))
      fs.writeFileSync(targetPath, '#!' + shebang + '\n' + source)
      fs.chmodSync(targetPath, 493) // 0o755
    }

    it('can run "npm test", absolute shebang edition', function (done) {
      if (isWindows) return done()

      writeFakeNPM(process.execPath)

      var args = [bin, 'npm', 'test']
      var directory = path.resolve(fixturesCLI, 'run-npm-test-recursive')
      var proc = spawn(process.execPath, args, {
        cwd: directory,
        env: {
          PATH: fakebin + ':' + env.PATH
        }
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        done()
      })
    })

    it('can run "npm test", weird bash+dirname shebang edition', function (done) {
      if (isWindows) return done()

      // This string is taken verbatim from tools/install.py in Node core v5.x
      writeFakeNPM('/bin/sh\n// 2>/dev/null; exec "`dirname "$0"`/node" "$0" "$@"')
      fs.symlinkSync(process.execPath, path.resolve(fakebin, 'node'))

      var args = [bin, 'npm', 'test']
      var directory = path.resolve(fixturesCLI, 'run-npm-test-recursive')
      var proc = spawn(process.execPath, args, {
        cwd: directory,
        env: {
          PATH: fakebin + ':' + env.PATH
        }
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        done()
      })
    })
  })

  describe('configuration', function () {
    it('passes configuration via environment variables', function (done) {
      var args = [
        bin,
        '--silent',
        '--require=make-dir',
        '--include=env.js',
        '--exclude=batman.js',
        '--extension=.js',
        '--cache=false',
        '--cache-dir=/tmp',
        '--source-map=true',
        process.execPath,
        './env.js'
      ]
      var expected = {
        instrumenter: './lib/instrumenters/istanbul',
        silent: true,
        cacheDir: '/tmp',
        cache: false,
        sourceMap: true
      }

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        var env = JSON.parse(stdout)
        var config = JSON.parse(env.NYC_CONFIG, null, 2)
        config.should.include(expected)
        config.include.should.include('env.js')
        config.exclude.should.include('batman.js')
        config.extension.should.include('.js')
        done()
      })
    })

    it('allows package.json configuration to be overridden with command line args', function (done) {
      var args = [bin, '--reporter=text-lcov', process.execPath, './half-covered.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdout.should.match(/SF:.*half-covered\.js/)
        done()
      })
    })

    describe('nyc.config.js', function () {
      var cwd = path.resolve(fixturesCLI, './nyc-config-js')

      it('loads configuration from package.json and nyc.config.js', function (done) {
        var args = [bin, process.execPath, './index.js']

        var proc = spawn(process.execPath, args, {
          cwd: cwd,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdout.should.match(/SF:.*index\.js/)
          stdout.should.not.match(/SF:.*ignore\.js/)
          stdout.should.not.match(/SF:.*nyc\.config\.js/)
          stdout.should.not.match(/SF:.*nycrc-config\.js/)
          done()
        })
      })

      it('loads configuration from different module rather than nyc.config.js', function (done) {
        var args = [bin, '--all', '--nycrc-path', './nycrc-config.js', process.execPath, './index.js']

        var proc = spawn(process.execPath, args, {
          cwd: cwd,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          // should be 1 due to coverage check
          code.should.equal(1)
          stdout.should.match(/SF:.*index\.js/)
          stdout.should.match(/SF:.*ignore\.js/)
          stdout.should.match(/SF:.*nyc\.config\.js/)
          stdout.should.match(/SF:.*nycrc-config\.js/)
          done()
        })
      })

      it('allows nyc.config.js configuration to be overridden with command line args', function (done) {
        var args = [bin, '--all', '--exclude=foo.js', process.execPath, './index.js']

        var proc = spawn(process.execPath, args, {
          cwd: cwd,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdout.should.match(/SF:.*index\.js/)
          stdout.should.match(/SF:.*ignore\.js/)
          stdout.should.match(/SF:.*nyc\.config\.js/)
          stdout.should.match(/SF:.*nycrc-config\.js/)
          done()
        })
      })
    })

    describe('.nycrc', function () {
      var cwd = path.resolve(fixturesCLI, './nycrc')

      it('loads configuration from package.json and .nycrc', function (done) {
        var args = [bin, process.execPath, './index.js']

        var proc = spawn(process.execPath, args, {
          cwd: cwd,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdout.should.match(/SF:.*index\.js/)
          stdout.should.not.match(/SF:.*ignore\.js/)
          done()
        })
      })

      it('loads configuration from different file rather than .nycrc', function (done) {
        var args = [bin, '--nycrc-path', './.nycrc-config.json', process.execPath, './index.js']

        var proc = spawn(process.execPath, args, {
          cwd: cwd,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          // should be 1 due to coverage check
          code.should.equal(1)
          stdout.should.match(/SF:.*index\.js/)
          stdout.should.match(/SF:.*ignore\.js/)
          done()
        })
      })

      it('allows .nycrc configuration to be overridden with command line args', function (done) {
        var args = [bin, '--exclude=foo.js', process.execPath, './index.js']

        var proc = spawn(process.execPath, args, {
          cwd: cwd,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdout.should.match(/SF:.*index\.js/)
          stdout.should.match(/SF:.*ignore\.js/)
          done()
        })
      })
    })
  })

  describe('coverage', function () {
    it('reports appropriate coverage information for es6 source files', function (done) {
      var args = [bin, '--reporter=lcov', '--reporter=text', process.execPath, './es6.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        // we should miss covering the appropriate lines.
        stdout.should.match(/11,16,17/)
        done()
      })
    })
  })

  describe('instrument', function () {
    beforeEach(() => {
      rimraf.sync(path.resolve(fixturesCLI, 'subdir', 'output-dir'))
    })

    describe('no output folder', function () {
      it('allows a single file to be instrumented', function (done) {
        var args = [bin, 'instrument', './half-covered.js']

        var proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdout.should.contain(`path:${JSON.stringify(path.resolve(fixturesCLI, 'half-covered.js'))}`)
          done()
        })
      })

      it('allows a directory of files to be instrumented', function (done) {
        var args = [bin, 'instrument', './']

        var proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdout.should.match(/half-covered\.js"/)
          stdout.should.match(/half-covered-failing\.js"/)
          stdout.should.not.match(/spawn\.js"/)
          done()
        })
      })

      it('returns unmodified source if there is no transform', function (done) {
        const args = [bin, 'instrument', './no-transform/half-covered.xjs']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        let stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdout.should.contain(`var a = 0`)
          done()
        })
      })
    })

    describe('output folder specified', function () {
      afterEach(function () {
        rimraf.sync(path.resolve(fixturesCLI, 'output'))
      })

      it('works in directories without a package.json', function (done) {
        const args = [bin, 'instrument', './input-dir', './output-dir']

        const subdir = path.resolve(fixturesCLI, 'subdir')
        const proc = spawn(process.execPath, args, {
          cwd: subdir,
          env: env
        })

        proc.on('exit', function (code) {
          code.should.equal(0)
          const target = path.resolve(subdir, 'output-dir', 'index.js')
          fs.readFileSync(target, 'utf8')
            .should.match(/console.log\('Hello, World!'\)/)
          done()
        })
      })

      it('can be configured to exit on error', function (done) {
        const args = [bin, 'instrument', '--exit-on-error', './input-dir', './output-dir']

        const subdir = path.resolve(fixturesCLI, 'subdir')
        const proc = spawn(process.execPath, args, {
          cwd: subdir,
          env: env
        })

        proc.on('exit', function (code) {
          code.should.equal(1)
          done()
        })
      })

      it('allows a single file to be instrumented', function (done) {
        const args = [bin, 'instrument', './half-covered.js', './output']

        const inputPath = path.resolve(fixturesCLI, './half-covered.js')
        const inputMode = fs.statSync(inputPath).mode & 0o7777
        const newMode = 0o775
        if (process.platform !== 'win32') {
          fs.chmodSync(inputPath, newMode)
        }

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
          files.length.should.equal(1)
          files.should.include('half-covered.js')

          if (process.platform !== 'win32') {
            const outputPath = path.resolve(fixturesCLI, 'output', 'half-covered.js')
            const outputMode = fs.statSync(outputPath).mode & 0o7777
            outputMode.should.equal(newMode)

            fs.chmodSync(inputPath, inputMode)
          }

          done()
        })
      })

      it('allows a directory of files to be instrumented', function (done) {
        const args = [bin, 'instrument', './nyc-config-js', './output']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
          files.should.include('index.js')
          files.should.include('ignore.js')
          files.should.not.include('package.json')
          files.should.not.include('node_modules')
          done()
        })
      })

      it('can instrument the project directory', function (done) {
        const args = [bin, 'instrument', '.', './output']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
          files.should.include('args.js')
          files.should.include('subdir')
          done()
        })
      })

      it('allows a sub-directory of files to be instrumented', function (done) {
        const args = [bin, 'instrument', './subdir/input-dir', './output']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
          files.should.include('index.js')
          done()
        })
      })

      it('allows a subdirectory to be excluded via .nycrc file', function (done) {
        const args = [bin, 'instrument', '--nycrc-path', './.instrument-nycrc', './subdir/input-dir', './output']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
          files.length.should.not.equal(0)
          files.should.not.include('exclude-me')
          files.should.not.include('node_modules')
          files.should.include('index.js')
          files.should.include('bad.js')
          const includeTarget = path.resolve(fixturesCLI, 'output', 'index.js')
          fs.readFileSync(includeTarget, 'utf8')
            .should.match(/var cov_/)
          done()
        })
      })

      it('allows a file to be excluded', function (done) {
        const args = [bin, 'instrument', '--exclude', 'exclude-me/index.js', './subdir/input-dir', './output']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
          files.length.should.not.equal(0)
          files.should.not.include('exclude-me')
          done()
        })
      })

      it('allows specifying a single sub-directory to be included', function (done) {
        const args = [bin, 'instrument', '--include', '**/include-me/**', './subdir/input-dir', './output']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
          files.length.should.not.equal(0)
          files.should.include('include-me')
          const instrumented = path.resolve(fixturesCLI, 'output', 'include-me', 'include-me.js')
          fs.readFileSync(instrumented, 'utf8')
            .should.match(/var cov_/)
          done()
        })
      })

      it('allows a file to be excluded from an included directory', function (done) {
        const args = [bin, 'instrument', '--exclude', '**/exclude-me.js', '--include', '**/include-me/**', './subdir/input-dir', './output']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
          files.length.should.not.equal(0)
          files.should.include('include-me')
          const includeMeFiles = fs.readdirSync(path.resolve(fixturesCLI, 'output', 'include-me'))
          includeMeFiles.length.should.not.equal(0)
          includeMeFiles.should.include('include-me.js')
          includeMeFiles.should.not.include('exclude-me.js')
          const instrumented = path.resolve(fixturesCLI, 'output', 'include-me', 'include-me.js')
          fs.readFileSync(instrumented, 'utf8')
            .should.match(/var cov_/)
          done()
        })
      })

      it('aborts if trying to write files in place', function (done) {
        const args = [bin, 'instrument', '--delete', './', './']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        let stderr = ''
        proc.stderr.on('data', function (chunk) {
          stderr += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(1)
          stderr.should.include('nyc instrument failed: cannot instrument files in place')
          done()
        })
      })

      it('aborts if trying to instrument files from outside the project root directory', function (done) {
        const args = [bin, 'instrument', '--delete', '../', './']

        const proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        let stderr = ''
        proc.stderr.on('data', function (chunk) {
          stderr += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(1)
          stderr.should.include('nyc instrument failed: cannot instrument files outside of project root directory')
          done()
        })
      })

      describe('es-modules', function () {
        afterEach(function () {
          rimraf.sync(path.resolve(fixturesCLI, './output'))
        })

        it('instruments file with `package` keyword when es-modules is disabled', function (done) {
          const args = [bin, 'instrument', '--no-es-modules', './not-strict.js', './output']

          const proc = spawn(process.execPath, args, {
            cwd: fixturesCLI,
            env: env
          })

          proc.on('close', function (code) {
            code.should.equal(0)
            const subdirExists = fs.existsSync(path.resolve(fixturesCLI, './output'))
            subdirExists.should.equal(true)
            const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
            files.should.include('not-strict.js')
            done()
          })
        })

        it('fails on file with `package` keyword when es-modules is enabled', function (done) {
          const args = [bin, 'instrument', '--exit-on-error', './not-strict.js', './output']

          const proc = spawn(process.execPath, args, {
            cwd: fixturesCLI,
            env: env
          })

          let stderr = ''
          proc.stderr.on('data', function (chunk) {
            stderr += chunk
          })

          proc.on('close', function (code) {
            code.should.equal(1)
            stdoutShouldEqual(stderr, `
              Failed to instrument ${path.resolve(fixturesCLI, 'not-strict.js')}`)
            const subdirExists = fs.existsSync(path.resolve(fixturesCLI, './output'))
            subdirExists.should.equal(false)
            done()
          })
        })
      })

      describe('delete', function () {
        beforeEach(function () {
          makeDir.sync(path.resolve(fixturesCLI, 'output', 'removed-by-clean'))
        })

        it('cleans the output directory if `--delete` is specified', function (done) {
          const args = [bin, 'instrument', '--delete', 'true', './subdir/input-dir', './output']

          const proc = spawn(process.execPath, args, {
            cwd: fixturesCLI,
            env: env
          })

          proc.on('close', function (code) {
            code.should.equal(0)
            const subdirExists = fs.existsSync(path.resolve(fixturesCLI, './output'))
            subdirExists.should.equal(true)
            const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
            files.should.not.include('removed-by-clean')
            files.should.include('exclude-me')
            done()
          })
        })

        it('does not clean the output directory by default', function (done) {
          const args = [bin, 'instrument', './subdir/input-dir', './output']

          const proc = spawn(process.execPath, args, {
            cwd: fixturesCLI,
            env: env
          })

          proc.on('close', function (code) {
            code.should.equal(0)
            const subdirExists = fs.existsSync(path.resolve(fixturesCLI, './output'))
            subdirExists.should.equal(true)
            const files = fs.readdirSync(path.resolve(fixturesCLI, './output'))
            files.should.include('removed-by-clean')
            done()
          })
        })

        it('aborts if trying to clean process.cwd()', function (done) {
          const args = [bin, 'instrument', '--delete', './src', './']

          const proc = spawn(process.execPath, args, {
            cwd: fixturesCLI,
            env: env
          })

          let stderr = ''
          proc.stderr.on('data', function (chunk) {
            stderr += chunk
          })

          proc.on('close', function (code) {
            code.should.equal(1)
            stderr.should.include('nyc instrument failed: attempt to delete')
            done()
          })
        })

        it('aborts if trying to clean outside working directory', function (done) {
          const args = [bin, 'instrument', '--delete', './', '../']

          const proc = spawn(process.execPath, args, {
            cwd: fixturesCLI,
            env: env
          })

          let stderr = ''
          proc.stderr.on('data', function (chunk) {
            stderr += chunk
          })

          proc.on('close', function (code) {
            code.should.equal(1)
            stderr.should.include('nyc instrument failed: attempt to delete')
            done()
          })
        })
      })
    })
  })

  describe('hooks', function () {
    it('provides coverage for requireJS and AMD modules', function (done) {
      var args = [bin, '--hook-run-in-this-context', '--hook-require=false', process.execPath, './index.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesHooks,
        env: process.env
      })
      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })
      proc.on('close', function (code) {
        code.should.equal(0)
        stdout.should.match(/ipsum\.js/)
        stdout.should.match(/lorem\.js/)
        done()
      })
    })
  })

  describe('args', function () {
    it('does not interpret args intended for instrumented bin', function (done) {
      var args = [bin, '--silent', process.execPath, 'args.js', '--help', '--version']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        var args = JSON.parse(stdout)
        args.should.include('--help')
        args.should.include('--version')
        args.should.not.include('--silent')
        done()
      })
    })

    it('interprets first args after -- as Node.js execArgv', function (done) {
      var args = [bin, '--', '--expose-gc', path.resolve(fixturesCLI, 'gc.js')]

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.setEncoding('utf8')
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdout.should.include('still running')
        done()
      })
    })
  })

  describe('--show-process-tree', function () {
    it('displays a tree of spawned processes', function (done) {
      var args = [bin, '--show-process-tree', process.execPath, 'selfspawn-fibonacci.js', '5']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.setEncoding('utf8')
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdout.should.match(new RegExp(
          'nyc\n' +
          '└─┬.*selfspawn-fibonacci.js 5\n' +
          '  │.* % Lines\n' +
          '  ├─┬.*selfspawn-fibonacci.js 4\n' +
          '  │ │.* % Lines\n' +
          '  │ ├─┬.*selfspawn-fibonacci.js 3\n' +
          '  │ │ │.* % Lines\n' +
          '  │ │ ├──.*selfspawn-fibonacci.js 2\n' +
          '  │ │ │.* % Lines\n' +
          '  │ │ └──.*selfspawn-fibonacci.js 1\n' +
          '  │ │    .* % Lines\n' +
          '  │ └──.*selfspawn-fibonacci.js 2\n' +
          '  │    .* % Lines\n' +
          '  └─┬.*selfspawn-fibonacci.js 3\n' +
          '    │.* % Lines\n' +
          '    ├──.*selfspawn-fibonacci.js 2\n' +
          '    │.* % Lines\n' +
          '    └──.*selfspawn-fibonacci.js 1\n' +
          '       .* % Lines\n'
        ))
        done()
      })
    })

    it('doesn’t create the temp directory for process info files when not present', function (done) {
      var args = [bin, process.execPath, 'selfspawn-fibonacci.js', '5']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('exit', function (code) {
        code.should.equal(0)
        fs.stat(path.resolve(fixturesCLI, '.nyc_output', 'processinfo'), function (err, stat) {
          err.code.should.equal('ENOENT')
          done()
        })
      })
    })
  })

  describe('--build-process-tree', function () {
    it('builds, but does not display, a tree of spawned processes', function (done) {
      var args = [bin, '--build-process-tree', process.execPath, 'selfspawn-fibonacci.js', '5']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.setEncoding('utf8')
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdout.should.not.match(new RegExp('└─'))
        const dir = path.resolve(fixturesCLI, '.nyc_output', 'processinfo')
        fs.statSync(dir)
        // make sure that the processinfo file has a numeric pid and ppid
        const files = fs.readdirSync(dir).filter(f => f !== 'index.json')
        const data = JSON.parse(fs.readFileSync(dir + '/' + files[0], 'utf8'))
        data.pid.should.be.a('number')
        data.ppid.should.be.a('number')
        done()
      })
    })

    it('doesn’t create the temp directory for process info files when not present', function (done) {
      var args = [bin, process.execPath, 'selfspawn-fibonacci.js', '5']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('exit', function (code) {
        code.should.equal(0)
        fs.stat(path.resolve(fixturesCLI, '.nyc_output', 'processinfo'), function (err, stat) {
          err.code.should.equal('ENOENT')
          done()
        })
      })
    })
  })

  describe('--temp-dir', function () {
    beforeEach(() => {
      rimraf.sync(path.resolve(fixturesCLI, '.nyc_output'))
      rimraf.sync(path.resolve(fixturesCLI, '.temp_directory'))
      rimraf.sync(path.resolve(fixturesCLI, '.temp_dir'))
    })

    it('creates the default \'tempDir\' when none is specified', function (done) {
      var args = [bin, process.execPath, './half-covered.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        var tempFiles = fs.readdirSync(path.resolve(fixturesCLI, '.nyc_output'))
        tempFiles.length.should.equal(1)
        var cliFiles = fs.readdirSync(path.resolve(fixturesCLI))
        cliFiles.should.include('.nyc_output')
        cliFiles.should.not.include('.temp_dir')
        cliFiles.should.not.include('.temp_directory')
        done()
      })
    })

    it('prefers \'tempDirectory\' to \'tempDir\'', function (done) {
      var args = [bin, '--tempDirectory', '.temp_directory', '--tempDir', '.temp_dir', process.execPath, './half-covered.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('exit', function (code) {
        code.should.equal(0)
        var tempFiles = fs.readdirSync(path.resolve(fixturesCLI, '.temp_directory'))
        tempFiles.length.should.equal(1)
        var cliFiles = fs.readdirSync(path.resolve(fixturesCLI))
        cliFiles.should.not.include('.nyc_output')
        cliFiles.should.not.include('.temp_dir')
        cliFiles.should.include('.temp_directory')
        done()
      })
    })

    it('uses the \'tempDir\' option if \'tempDirectory\' is not set', function (done) {
      var args = [bin, '--tempDir', '.temp_dir', process.execPath, './half-covered.js']

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('exit', function (code) {
        code.should.equal(0)
        var tempFiles = fs.readdirSync(path.resolve(fixturesCLI, '.temp_dir'))
        tempFiles.length.should.equal(1)
        var cliFiles = fs.readdirSync(path.resolve(fixturesCLI))
        cliFiles.should.not.include('.nyc_output')
        cliFiles.should.include('.temp_dir')
        cliFiles.should.not.include('.temp_directory')
        rimraf.sync(path.resolve(fixturesCLI, '.temp_dir'))
        done()
      })
    })
  })

  describe('noop instrumenter', function () {
    it('setting instrument to "false" configures noop instrumenter', function (done) {
      var args = [
        bin,
        '--silent',
        '--no-instrument',
        '--no-source-map',
        process.execPath,
        './env.js'
      ]
      var expected = {
        silent: true,
        instrument: false,
        sourceMap: false,
        instrumenter: './lib/instrumenters/noop'
      }

      var proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        var env = JSON.parse(stdout)
        var config = JSON.parse(env.NYC_CONFIG, null, 2)
        config.should.include(expected)
        done()
      })
    })

    describe('--all', function () {
      it('extracts coverage headers from unexecuted files', function (done) {
        var nycOutput = path.resolve(fixturesCLI, '.nyc_output')
        rimraf.sync(nycOutput)

        var args = [
          bin,
          '--all',
          '--silent',
          '--no-instrument',
          '--no-source-map',
          process.execPath,
          // any file other than external-instrument.js, which we
          // want to ensure has its header loaded.
          './env.js'
        ]

        var proc = spawn(process.execPath, args, {
          cwd: fixturesCLI,
          env: env
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          glob(nycOutput + '/*.json', function (_err, files) {
            // we should have extracted the coverage header from external-instrumenter.js.
            var coverage = {}
            files.forEach(function (file) {
              _.assign(coverage, JSON.parse(
                fs.readFileSync(file, 'utf-8')
              ))
            })
            Object.keys(coverage).should.include('./external-instrumenter.js')

            // we should not have executed file, so all counts sould be 0.
            var sum = 0
            Object.keys(coverage['./external-instrumenter.js'].s).forEach(function (k) {
              sum += coverage['./external-instrumenter.js'].s[k]
            })
            sum.should.equal(0)

            return done()
          })
        })
      })
    })
  })

  it('allows an alternative cache folder to be specified', function (done) {
    var args = [bin, '--cache-dir=./foo-cache', '--cache=true', process.execPath, './half-covered.js']

    var proc = spawn(process.execPath, args, {
      cwd: fixturesCLI,
      env: env
    })
    proc.on('close', function (code) {
      code.should.equal(0)
      // we should have created ./foo-cache rather
      // than the default ./node_modules/.cache.
      fs.readdirSync(path.resolve(
        fixturesCLI, './foo-cache'
      )).length.should.equal(1)
      rimraf.sync(path.resolve(fixturesCLI, 'foo-cache'))
      done()
    })
  })

  // see: https://github.com/istanbuljs/nyc/issues/563
  it('does not create .cache folder if cache is "false"', function (done) {
    var args = [bin, '--cache=false', process.execPath, './index.js']

    var proc = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: env
    })

    rimraf.sync('./node_modules/.cache')

    proc.on('close', function (code) {
      code.should.equal(0)
      fs.existsSync('./node_modules/.cache').should.equal(false)
      done()
    })
  })

  it('allows alternative high and low watermarks to be configured', function (done) {
    var args = [
      bin,
      '--watermarks.lines=90',
      '--watermarks.lines=100',
      '--watermarks.statements=30',
      '--watermarks.statements=40',
      '--cache=true',
      process.execPath,
      './half-covered.js'
    ]

    var proc = spawn(process.execPath, args, {
      cwd: fixturesCLI,
      env: {
        PATH: process.env.PATH,
        FORCE_COLOR: true
      }
    })

    var stdout = ''
    proc.stdout.on('data', function (chunk) {
      stdout += chunk
    })

    proc.on('close', function (code) {
      code.should.equal(0)
      // 50% line coverage is below our low watermark (so it's red).
      stdout.should.match(/\[31;1m\W+50\W+/)
      // 50% statement coverage is above our high-watermark (so it's green).
      stdout.should.match(/\[32;1m\W+50\W+/)
      done()
    })
  })

  // the following tests exercise nyc's behavior around source-maps
  // that have been included with pre-instrumented files. Perhaps, as an
  // example, unit tests are being run against minified JavaScript.
  // --exclude-after-remap will likely need to be set to false when
  // using nyc with this type of configuration.
  describe('source-maps', () => {
    describe('--all', () => {
      it('includes files with both .map files and inline source-maps', (done) => {
        const args = [
          bin,
          '--all',
          '--cache', 'false',
          '--exclude-after-remap', 'false',
          '--exclude', 'original',
          process.execPath, './instrumented/s1.min.js'
        ]

        const proc = spawn(process.execPath, args, {
          cwd: fixturesSourceMaps,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdoutShouldEqual(stdout, `
            ----------|----------|----------|----------|----------|-------------------|
            File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
            ----------|----------|----------|----------|----------|-------------------|
            All files |    44.44 |      100 |    33.33 |    44.44 |                   |
             s1.js    |       80 |      100 |       50 |       80 |                 7 |
             s2.js    |        0 |      100 |        0 |        0 |           1,2,4,6 |
            ----------|----------|----------|----------|----------|-------------------|`
          )
          done()
        })
      })

      it('uses source-maps to exclude original sources from reports', (done) => {
        const args = [
          bin,
          '--all',
          '--cache', 'false',
          '--exclude', 'original/s1.js',
          process.execPath, './instrumented/s1.min.js'
        ]

        const proc = spawn(process.execPath, args, {
          cwd: fixturesSourceMaps,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdoutShouldEqual(stdout, `
            ----------|----------|----------|----------|----------|-------------------|
            File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
            ----------|----------|----------|----------|----------|-------------------|
            All files |        0 |      100 |        0 |        0 |                   |
             s2.js    |        0 |      100 |        0 |        0 |           1,2,4,6 |
            ----------|----------|----------|----------|----------|-------------------|`
          )
          done()
        })
      })
    })

    describe('.map file', () => {
      it('appropriately instruments file with corresponding .map file', (done) => {
        const args = [
          bin,
          '--cache', 'false',
          '--exclude-after-remap', 'false',
          '--exclude', 'original',
          process.execPath, './instrumented/s1.min.js'
        ]

        const proc = spawn(process.execPath, args, {
          cwd: fixturesSourceMaps,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdoutShouldEqual(stdout, `
          ----------|----------|----------|----------|----------|-------------------|
          File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
          ----------|----------|----------|----------|----------|-------------------|
          All files |       80 |      100 |       50 |       80 |                   |
           s1.js    |       80 |      100 |       50 |       80 |                 7 |
          ----------|----------|----------|----------|----------|-------------------|`)
          done()
        })
      })
    })

    describe('inline', () => {
      it('appropriately instruments a file with an inline source-map', (done) => {
        const args = [
          bin,
          '--cache', 'false',
          '--exclude-after-remap', 'false',
          '--exclude', 'original',
          process.execPath, './instrumented/s2.min.js'
        ]

        const proc = spawn(process.execPath, args, {
          cwd: fixturesSourceMaps,
          env: env
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', function (code) {
          code.should.equal(0)
          stdoutShouldEqual(stdout, `
            ----------|----------|----------|----------|----------|-------------------|
            File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
            ----------|----------|----------|----------|----------|-------------------|
            All files |      100 |      100 |      100 |      100 |                   |
             s2.js    |      100 |      100 |      100 |      100 |                   |
            ----------|----------|----------|----------|----------|-------------------|`)
          done()
        })
      })
    })
  })

  describe('skip-empty', () => {
    it('does not display 0-line files in coverage output', (done) => {
      const args = [
        bin,
        '--cache', 'false',
        '--skip-empty', 'true',
        process.execPath, './empty.js'
      ]

      const proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.stdout.on('error', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdoutShouldEqual(stdout, `
        ----------|----------|----------|----------|----------|-------------------|
        File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
        ----------|----------|----------|----------|----------|-------------------|
        ----------|----------|----------|----------|----------|-------------------|`)
        done()
      })
    })
  })

  describe('skip-full', () => {
    it('does not display files with 100% statement, branch, and function coverage', (done) => {
      const args = [
        bin,
        '--skip-full',
        process.execPath, './skip-full.js'
      ]

      const proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdoutShouldEqual(stdout, `
        -----------------|----------|----------|----------|----------|-------------------|
        File             |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
        -----------------|----------|----------|----------|----------|-------------------|
        All files        |     62.5 |       50 |      100 |     62.5 |                   |
         half-covered.js |       50 |       50 |      100 |       50 |             6,7,8 |
        -----------------|----------|----------|----------|----------|-------------------|`)
        done()
      })
    })
  })

  describe('es-modules', () => {
    it('allows reserved word when es-modules is disabled', (done) => {
      const args = [
        bin,
        '--cache', 'false',
        '--es-modules', 'false',
        process.execPath, './not-strict.js'
      ]

      const proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(0)
        stdoutShouldEqual(stdout, `
        ---------------|----------|----------|----------|----------|-------------------|
        File           |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
        ---------------|----------|----------|----------|----------|-------------------|
        All files      |      100 |      100 |      100 |      100 |                   |
         not-strict.js |      100 |      100 |      100 |      100 |                   |
        ---------------|----------|----------|----------|----------|-------------------|`)
        done()
      })
    })

    it('forbids reserved word when es-modules is not disabled', (done) => {
      const args = [
        bin,
        '--cache', 'false',
        '--exit-on-error', 'true',
        process.execPath, './not-strict.js'
      ]

      const proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      var stderr = ''
      proc.stderr.on('data', function (chunk) {
        stderr += chunk
      })

      proc.on('close', function (code) {
        code.should.equal(1)
        stdoutShouldEqual(stderr, `
        Failed to instrument ${path.join(fixturesCLI, 'not-strict.js')}`)
        stdoutShouldEqual(stdout, `
        ----------|----------|----------|----------|----------|-------------------|
        File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
        ----------|----------|----------|----------|----------|-------------------|
        All files |        0 |        0 |        0 |        0 |                   |
        ----------|----------|----------|----------|----------|-------------------|`)
        done()
      })
    })
  })

  describe('merge', () => {
    it('combines multiple coverage reports', (done) => {
      const args = [
        bin,
        'merge',
        './merge-input'
      ]

      const proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      proc.on('close', function (code) {
        const mergedCoverage = require('./fixtures/cli/coverage')
        // the combined reports should have 100% function
        // branch and statement coverage.
        mergedCoverage['/private/tmp/contrived/library.js']
          .s.should.eql({ '0': 2, '1': 1, '2': 1, '3': 2, '4': 1, '5': 1 })
        mergedCoverage['/private/tmp/contrived/library.js']
          .f.should.eql({ '0': 1, '1': 1, '2': 2 })
        mergedCoverage['/private/tmp/contrived/library.js']
          .b.should.eql({ '0': [1, 1] })
        rimraf.sync(path.resolve(fixturesCLI, 'coverage.json'))
        return done()
      })
    })

    it('reports error if input directory is missing', (done) => {
      const args = [
        bin,
        'merge',
        './DIRECTORY_THAT_IS_MISSING'
      ]

      const proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stderr = ''
      proc.stderr.on('data', function (chunk) {
        stderr += chunk
      })

      proc.on('close', function (code) {
        stderr.should.match(/failed access input directory/)
        return done()
      })
    })

    it('reports error if input is not a directory', (done) => {
      const args = [
        bin,
        'merge',
        './package.json'
      ]

      const proc = spawn(process.execPath, args, {
        cwd: fixturesCLI,
        env: env
      })

      var stderr = ''
      proc.stderr.on('data', function (chunk) {
        stderr += chunk
      })

      proc.on('close', function (code) {
        stderr.should.match(/was not a directory/)
        return done()
      })
    })
  })

  describe('exclude-node-modules', () => {
    const fixturesENM = path.resolve(__dirname, './fixtures/exclude-node-modules')
    const globalArgs = [
      bin,
      '--all=true',
      '--cache=false',
      '--per-file=true',
      '--exclude-node-modules=false',
      '--include=node_modules/@istanbuljs/fake-module-1/**'
    ]
    const spawnOpts = {
      cwd: fixturesENM,
      env: env
    }
    const noCoverageError = `ERROR: Coverage for lines (0%) does not meet threshold (90%) for ${path.join(fixturesENM, 'node_modules/@istanbuljs/fake-module-1/index.js')}\n`

    it('execute', done => {
      function checkReport (code, stderr, stdout, next) {
        code.should.equal(1)
        stderr.should.equal(noCoverageError)
        stdoutShouldEqual(stdout, `
          ----------|----------|----------|----------|----------|-------------------|
          File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
          ----------|----------|----------|----------|----------|-------------------|
          All files |        0 |      100 |      100 |        0 |                   |
           index.js |        0 |      100 |      100 |        0 |                 1 |
          ----------|----------|----------|----------|----------|-------------------|`)
        next()
      }

      function executeMainCommand () {
        const args = [
          ...globalArgs,
          '--check-coverage=true',
          process.execPath, './bin/do-nothing.js'
        ]

        const proc = spawn(process.execPath, args, spawnOpts)

        var stderr = ''
        proc.stderr.on('data', function (chunk) {
          stderr += chunk
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', code => checkReport(code, stderr, stdout, executeReport))
      }

      function executeReport () {
        const args = [
          ...globalArgs,
          '--check-coverage=true',
          'report'
        ]

        const proc = spawn(process.execPath, args, spawnOpts)

        var stderr = ''
        proc.stderr.on('data', function (chunk) {
          stderr += chunk
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', code => checkReport(code, stderr, stdout, executeCheckCoverage))
      }

      function executeCheckCoverage () {
        const args = [
          ...globalArgs,
          'check-coverage'
        ]

        const proc = spawn(process.execPath, args, spawnOpts)

        var stderr = ''
        proc.stderr.on('data', function (chunk) {
          stderr += chunk
        })

        var stdout = ''
        proc.stdout.on('data', function (chunk) {
          stdout += chunk
        })

        proc.on('close', code => {
          code.should.equal(1)
          stderr.should.equal(noCoverageError)
          stdoutShouldEqual(stdout, '')
          done()
        })
      }

      executeMainCommand()
    })

    it('instrument', done => {
      const args = [
        ...globalArgs,
        'instrument',
        'node_modules'
      ]

      const proc = spawn(process.execPath, args, spawnOpts)

      var stderr = ''
      proc.stderr.on('data', function (chunk) {
        stderr += chunk
      })

      var stdout = ''
      proc.stdout.on('data', function (chunk) {
        stdout += chunk
      })

      proc.on('close', code => {
        code.should.equal(0)
        stderr.should.equal('')
        stdout.should.match(/fake-module-1/)
        stdout.should.not.match(/fake-module-2/)
        done()
      })
    })
  })
})

function stdoutShouldEqual (stdout, expected) {
  `\n${stdout}`.should.equal(`${si(expected)}\n`)
}

# amdloader

## Introduction
This repository provides an implementatoin base on [AMD](https://github.com/amdjs/amdjs-api/blob/master/AMD.md) for understanding the big picture of the [specification](https://github.com/amdjs/amdjs-api/blob/master/AMD.md). The community has lots of greate implementations, such as [requirejs](https://github.com/requirejs/requirejs), [esl](https://github.com/ecomfe/esl), [kittyjs](https://github.com/zengjialuo/kittyjs) and so on that are the references of this implementation.

## Test
[Amdjs-tests](https://github.com/amdjs/amdjs-tests) is the official tests of AMD. [Amdloader](https://github.com/dzyhenry/amdloader) has passed the tests of the features below.

|  Feature             |  implementation      |
| -------------------- | -------------------- |
| `basic`              |    true              |
| `anon`               |    true              |
| `funcString`         |    true              |
| `namedWrapped`       |    true              |
| `require`            |    true              |
| `pathsConfig`        |    true              |
| `packagesConfig`     |    true              |
| `mapConfig`          |    true              |
| `moduleConfig`       |    true              |
| `plugins`            |    false             |
| `shimConfig`         |    false             |
| `pluginDynamic`      |    false             |

### How to test
- `~ git clone https://github.com/dzyhenry/amdloader.git`
- `~ yarn install`
- `~ node test/amdjs-tests/server/server`
-  Open: http://localhost:4000 in your browser to check the test result.

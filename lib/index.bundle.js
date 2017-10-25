var amdloader = (function (global) {
'use strict';

global = global && global.hasOwnProperty('default') ? global['default'] : global;

/* eslint no-param-reassign: 0 */
const emptyFunc = () => {};

const STATUS = {
  UNFETCH: 0,
  FETCHING: 1,
  FETCHED: 2,
  LOADING: 3,
  LOADED: 4,
  EXECUTED: 5
};

const deepExtend = (target, source) => {
  Object.keys(source).forEach(key => {
    if (typeof target[key] === 'object') {
      deepExtend(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  });
};

/**
 * Test whether str starts with prefix. Use '/' to complete pathname.
 */
const hasPrefix = (str, prefix) => `${str}/`.indexOf(`${prefix}/`) === 0;

/**
 * map to sorted list, transform an object to an sorted array. The sort rule examples:
 * { a: 1, b: 2, c: 3 } => [{ k: a, v: 1 }, { k: b, v: 2 } , { k: a, v: 3 }];
 * { '*': 'barv1.0', 'some/old': 'barv0.1', 'some/new': 'barv1.1' } =>
 *              [{ k: 'some/old',v: 'barv0.1' },{ k: 'some/new',v: 'barv1.1' },{ k: '*', v: 'barv1.0' }]
 * @param { Object } obj, the object to transform
 * @returns { Array }
 */
const mapToSortedList = obj => {
  const list = [];
  Object.keys(obj).forEach(key => {
    list.push({ k: key, v: obj[key] });
  });
  list.sort((a, b) => {
    if (b.k === '*') {
      return -1;
    }
    if (a.k === '*') {
      return 1;
    }
    return b.k.length - a.k.length;
  });
  return list;
};

/**
 * Get dirname of uri. Examples:
 * file:///Users/henry/a/b/c => file:///Users/henry/a/b 
 * https://www.google.com/a/b/c#/a/b/c/?q=s => https://www.google.com/a/b
 * @param { String } uri
 * @returns { String } the relative dirname
 */
const dirName = uri => {
  const dir = uri.match(/([^?#]*)(\/[^$])/);
  return dir && dir[1] || '';
};

/**
 * Get relative uri by base. Relative module ID resolution examples:
 * ( uri: ../d, base: a/b/c ) => a/d
 * ( uri: ./e, base: a/b/c ) => a/b/e
 * @param { String } uri, input uri
 * @param { String } base, base uri
 * @returns { String } target uri 
 */
const relativeUri = (uri, base) => {
  const segments = base.split('/').concat(uri.split('/'));
  const path = [];
  segments.forEach(seg => {
    if (!seg || seg === '.') {
      return;
    }
    if (seg === '..') {
      path.pop();
    } else {
      path.push(seg);
    }
  });
  return path.join('/');
};

/**
 * Conditional iterate, breaks when iterator(item, idx) === false
 * @param { Array } arr to iterate
 * @param { Function } iterator of each array element, iterator(item, idx)
 * @returns { Undefined } returns nothing
 */
const conditionalIterate = (arr, iterator) => {
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i += 1) {
      if (iterator(arr[i], i) === false) {
        break;
      }
    }
  }
};

/**
 * If a module is a builtin module return false, otherwise, return true 
 * @param { String } module id
 * @returns { Boolean } whether a module is a builtin module
 */
const isBuiltInModule = id => {
  const builtinModule = {
    require: true,
    exports: true,
    module: true
  };
  return !!builtinModule[id];
};

/* eslint no-plusplus: 0, no-use-before-define: 0, no-param-reassign: 0 */
const cachedModules = {}; // cache loaded modules
const cwd = dirName(location.pathname); // Current working directory, the relative dir name.

let currentlyAddingScript = null;
let interactiveScript = null;
const headElement = document.getElementsByTagName('head')[0];

let uid = 0; // Unique id to idenity loaded modules.
const getUid = () => `./async_${uid++}`;

const config = {
  baseUrl: cwd,
  paths: [],
  map: {},
  packages: [],
  pathList: [],
  mapList: [],
  shim: {}
};

class Module {
  constructor(id) {
    this.id = id;
    this.uri = id2Uri(id);
    this.deps = [];
    this.depsDec = true;
    this.state = STATUS.UNFETCH;
    this.factory = emptyFunc;
    this.exports = {};

    this.require = requireFactory(getUid());
    this.require.toUrl = iid => {
      const absId = resolveId(iid);
      return id2Uri(absId);
    };

    this.loadListeners = []; // Invoke these listeners to inform the dependent modules to handle dependencies when module loaded.  
  }

  loadModule() {
    if (this.state === STATUS.FETCHING) {
      return;
    }
    if (this.state <= STATUS.UNFETCH) {
      this.fetchModule();
      return;
    }

    this.state = STATUS.LOADING;
    const deps = this.deps || [];
    this.remain = deps.length;

    const onDependencyLoaded = () => {
      this.remain -= 1;
      if (this.remain === 0) {
        this.onModuleLoaded();
      }
    };

    deps.forEach(dep => {
      if (isBuiltInModule(dep)) {
        this.remain -= 1;
        return;
      }

      if (dep.indexOf('!') > -1) {
        this.loadPlugin(dep, onDependencyLoaded);
        return;
      }

      const absId = resolveId(dep, this.id);
      const m = getModule(absId);
      if (m.state >= STATUS.LOADED || m.state === STATUS.LOADING && !this.isForce) {
        // equal situation is for circle dependency
        this.remain -= 1;
        return;
      }
      m.loadListeners.push(onDependencyLoaded);
      if (m.state < STATUS.LOADING) {
        m.loadModule();
      }
    });

    if (this.remain === 0) {
      this.onModuleLoaded();
    }
  }

  onModuleLoaded() {
    if (this.state >= STATUS.LOADED) {
      return;
    }

    this.state = STATUS.LOADED;
    this.loadListeners.forEach(listener => {
      listener();
    });

    if (typeof this.callback === 'function') {
      this.callback();
    }
  }

  fetchModule() {
    this.state = STATUS.FETCHING;
    const onModuleFetched = () => {
      const readyState = script.readyState;
      if (readyState === undefined || /^(loaded || complete)$/.test(readyState)) {
        this.state = STATUS.FETCHED;
        this.loadModule();
        interactiveScript = null;
      }
    };
    const script = document.createElement('script');
    script.src = `${this.uri}.js`;
    script.setAttribute('data-module-id', this.id);
    script.async = true;
    if (script.readyState) {
      script.onreadystatechange = onModuleFetched;
    } else {
      script.onload = onModuleFetched;
    }

    // append script
    currentlyAddingScript = script;
    headElement.appendChild(script);
    currentlyAddingScript = null;
  }

  executeModule() {
    if (this.state >= STATUS.EXECUTED) {
      return this.exports;
    }
    const dependencies = this.getDependencyExports();
    if (typeof this.factory === 'function') {
      const res = this.factory.apply(null, dependencies);
      this.exports = res || this.exports;
    } else {
      this.exports = this.factory;
    }
    this.state = STATUS.EXECUTED;
    return this.exports;
  }

  // get module dependencies
  getDependencyExports() {
    if (this.state < STATUS.LOADED) {
      throw new Error('Get dependencies export before loaded.');
    }

    let exports = [];
    if (!this.depsDec) {
      exports = [this.require, this.exports, this];
    } else {
      const deps = this.deps || [];
      const argsLen = this.factory.length < deps.length ? this.factory.length : deps.length;
      for (let i = 0; i < argsLen; i++) {
        switch (deps[i]) {
          case 'require':
            exports.push(this.require);
            break;
          case 'exports':
            exports.push(this.exports);
            break;
          case 'module':
            exports.push(this);
            break;
          default:
            exports.push(this.require(deps[i]));
        }
      }
    }
    return exports;
  }
}
/**
 * Resolve module id
 * @param { String } id, the id of module
 * @param { String } base, the base uri of the module for resolving id
 * @returns { String } return the resolved id
 */
const resolveId = (id, base) => {
  id = packagedId(id);
  id = mappedId(id, base);

  if (id.indexOf('.') === 0) {
    id = relativeUri(id, dirName(base));
  }

  id = packagedId(id);
  return id;
};

/**
 * To support package config: http://requirejs.org/docs/api.html#packages
 * @param { String } id
 * @returns { String } packaged id
 */
const packagedId = id => {
  conditionalIterate(config.packages, pkg => {
    if (pkg.name === id) {
      id = `${pkg.name}/${pkg.main || 'main'}`;
    }
    return false;
  });
  return id;
};

/**
 * To support map config: http://requirejs.org/docs/api.html#config-map
 * @param { String } id, the module id
 * @param { String } base, the base url of the id
 * @returns { String } the mapped id.
 */
const mappedId = (id, base) => {
  conditionalIterate(config.mapList, item => {
    if (hasPrefix(base, item.k) || item.k === '*') {
      conditionalIterate(item.v, map => {
        if (hasPrefix(id, map.k)) {
          id = id.replace(map.k, map.v);
          return false;
        }
        return true;
      });
      return false;
    }
    return true;
  });
  return id;
};

/**
 * Get the module url of specified module id. 
 * @param { String } The resolved id of the module.
 * @returns { String } The loading path of the module.
 */
const id2Uri = id => {
  config.pathList.forEach(pathMap => {
    if (hasPrefix(id, pathMap.k)) {
      id = id.replace(pathMap.k, pathMap.v);
    }
  });

  // absolute path
  if (id.charAt('0') === '/' || id.indexOf('http') === '0') {
    return id;
  }
  return `/${relativeUri(id, config.baseUrl || cwd)}`;
};

/**
 * If cached, return cached module, otherwise, return a new module. 
 * @param { String } id, module id
 * @returns { Module } return the corresponding module
 */
const getModule = id => {
  const mod = cachedModules[id];
  if (mod) {
    return mod;
  }
  cachedModules[id] = new Module(id);
  return cachedModules[id];
};

const getCurrentScript = () => {
  if (document.currentScript) {
    return document.currentScript;
  }

  if (currentlyAddingScript) {
    return currentlyAddingScript;
  }

  if (interactiveScript && interactiveScript.readyState === 'interactive') {
    return interactiveScript;
  }

  const scritps = document.getElementsByTagName('script');
  scritps.forEach(script => {
    if (script.readyState === 'interactive') {
      interactiveScript = script;
    }
  });

  return interactiveScript;
};

/**
 * define function, for detail: https://github.com/amdjs/amdjs-api/blob/master/AMD.md#define-function-
 * @param { String } module id to define, optional
 * @param { Array } deps, dependent modules of this module
 * @param { Function or Object } factory function of the module
 * @returns { Undefined } returns nothing
 */
const define = (id, deps, factory) => {
  if (deps === undefined && factory === undefined) {
    // define(factory)
    factory = id;
    id = null;
  } else if (factory === undefined) {
    // define(id, factory);
    // define(deps, factory);
    factory = deps;
    deps = null;
    if (Array.isArray(id)) {
      deps = id;
      id = null;
    }
  }

  let depsDec = true;
  if (!Array.isArray(deps) && typeof factory === 'function') {
    deps = [];
    factory.toString().replace(/(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg, '').replace(/[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g, (match, dep) => {
      deps.push(dep);
    });
    depsDec = false;
  }

  if (!id) {
    const script = getCurrentScript();
    id = script && script.getAttribute('data-module-id');
  }

  if (!id) {
    return;
  }

  const mod = getModule(id);
  mod.id = id;
  mod.deps = deps || [];
  mod.depsDec = depsDec;
  mod.factory = factory;
  mod.state = STATUS.FETCHED;
};
define.amd = {};

/**
 * require function factory
 * @param { String }, base id
 * @returns { Function }, require function: https://github.com/amdjs/amdjs-api/blob/master/require.md
 */
const requireFactory = base => (deps, callback, isForce) => {
  if (!Array.isArray(deps)) {
    // require('a') or require('a!./b')
    const id = resolveId(deps, base);
    return getModule(id).executeModule();
  }
  const randomId = resolveId(getUid(), base);
  const mod = new Module(randomId);
  mod.deps = deps;
  mod.factory = callback || emptyFunc;
  mod.callback = () => {
    mod.deps.forEach(dep => {
      if (dep.indexOf('!') === -1 && !isBuiltInModule(dep)) {
        mod.require(dep);
      }
    });
    mod.executeModule();
  };
  mod.state = STATUS.FETCHED;
  mod.isForce = isForce;
  mod.loadModule();
  return mod;
};

// require function implementation: https://github.com/amdjs/amdjs-api/blob/master/require.md
const require = requireFactory(getUid());
require.config = obj => {
  deepExtend(config, obj);
  if (obj.baseUrl) {
    if (obj.baseUrl.charAt(0) === '.') {
      config.baseUrl = relativeUri(obj.baseUrl, cwd);
    } else {
      config.baseUrl = obj.baseUrl;
    }
  }

  config.packages.forEach((packageConf, idx) => {
    if (typeof packageConf === 'string') {
      const segments = packageConf.split('/');
      config.packages[idx] = {
        name: segments[0],
        location: packageConf,
        main: 'main'
      };
    }

    if (packageConf.main) {
      packageConf.main = packageConf.main.replace('.js', '');
    }

    if (packageConf.location) {
      config.paths[packageConf.name] = packageConf.location;
    }
  });

  config.mapList = mapToSortedList(config.map);
  config.mapList.forEach(item => {
    item.v = mapToSortedList(item.v);
  });

  config.pathList = mapToSortedList(config.paths);
};

if (!global.require) {
  global.require = require;
  global.define = define;
  global.cachedModules = cachedModules;
}

var index = {
  cachedModules,
  require,
  define
};

return index;

}(this));
//# sourceMappingURL=index.bundle.js.map

/* eslint no-param-reassign: 0 */
export const emptyFunc = () => {};

export const STATUS = {
  UNFETCH: 0,
  FETCHING: 1,
  FETCHED: 2,
  LOADING: 3,
  LOADED: 4,
  EXECUTED: 5,
};

export const deepExtend = (target, source) => {
  Object.keys(source).forEach((key) => {
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
export const hasPrefix = (str, prefix) => (`${str}/`.indexOf(`${prefix}/`) === 0);

/**
 * map to sorted list, transform an object to an sorted array. The sort rule examples:
 * { a: 1, b: 2, c: 3 } => [{ k: a, v: 1 }, { k: b, v: 2 } , { k: a, v: 3 }];
 * { '*': 'barv1.0', 'some/old': 'barv0.1', 'some/new': 'barv1.1' } =>
 *              [{ k: 'some/old',v: 'barv0.1' },{ k: 'some/new',v: 'barv1.1' },{ k: '*', v: 'barv1.0' }]
 * @param { Object } obj, the object to transform
 * @returns { Array }
 */
export const mapToSortedList = (obj) => {
  const list = [];
  Object.keys(obj).forEach((key) => {
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
export const dirName = (uri) => {
  const dir = uri.match(/([^?#]*)(\/[^$])/);
  if (Array.isArray(dir)) {
    return dir[1];
  }
  return '';
};

/**
 * Get relative uri by base. Relative module ID resolution examples:
 * ( uri: ../d, base: a/b/c ) => a/d
 * ( uri: ./e, base: a/b/c ) => a/b/e
 * @param { String } uri, input uri
 * @param { String } base, base uri
 * @returns { String } target uri 
 */
export const relativeUri = (uri, base) => {
  const segments = base.split('/').concat(uri.split('/'));
  const path = [];
  segments.forEach((seg) => {
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
export const conditionalIterate = (arr, iterator) => {
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
export const isBuiltInModule = (id) => {
  const builtinModule = {
    require: true,
    exports: true,
    module: true,
  };
  return !!builtinModule[id];
};

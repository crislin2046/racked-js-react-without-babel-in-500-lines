"use strict";
{
  const VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "command",
    "embed",
    "hr",
    "img",
    "input",
    "keygen",
    "link",
    "menuitem",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ]);
  const MAYBE_CAN_FOCUS = [
    '[tabindex]:not([tabindex^="-"])',
    'a[href]',
    'area[href]',
    'button',
    'details',
    'input',
    'iframe',
    'select',
    'textarea',
    '[contenteditable]',
  ].join(', ');
  
  const DATE_MATCHER = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/;
  const LAST_ATTR_NAME = /\s+([\w-]+)\s*=\s*"?\s*$/;

  class Component {
    constructor(props = {}) {
      this.props = Object.assign({},props);
      this.state = {};
      Object.assign(this.state,this.props);
    }
    setState(newState) {
      const focusElement = document.activeElement;
      const recoverFocus = focusRecoverable(focusElement);
      let focusSelector;
      if ( recoverFocus ) {
        focusSelector = getSelector(focusElement);
      }
      switch( typeof newState ) {
        case "function":
          this.setState(newState(Object.assign({},this.state),this.props));
          break;
        case "object":
          Object.assign(this.state,newState);
          break;
        default:
          this.state = newState;
          break;
      }
      self.Racked.render(this.render(),this.root);
      setTimeout( () => {
        if ( !! focusSelector ) {
          if ( ! document.activeElement.matches(focusSelector) ) {
            (this.root || document).querySelector(focusSelector).focus();
          }
        }
      }, 0 );
    }
    componentDidMount() {}
  }

  const Racked = { Component };

  Object.assign(self, {Racked});
  Object.assign(self, {df,fc});
  Object.assign(self,{VOID_ELEMENTS,R});
  Object.assign(self,{save,load});
  Object.assign(self,{clone,descendent});

  function df( t ) {
    return (new DOMParser).parseFromString(`<template>${t}</template>`,"text/html").head.firstElementChild.content;
  }
  
  function fc( t ) {
    return (new DOMParser).parseFromString(`<template>${t}</template>`,"text/html").head.firstElementChild.content.firstElementChild;
  }

  function R(parts, ...vals) {
    parts = Array.from(parts);
    const handlers = { };
    const stack = [];
    vals = vals.map( v => {
      if ( Array.isArray(v) && v.every(item => !!item.handlers && !!item.str) ) {
        return v.map(
            r => (Object.assign(handlers,r.handlers), r.str)
          )
          .join('\n');
      } else if ( typeof v === "object" && !(v.handlers && v.str) ) {
        return save(v);
      } else return v;
    });
    let str = '';
    let isAttr = false;
    let hasQuote = false;
    let killFirstQuote = false;
    while(parts.length > 1) {
      let part = parts.shift();
      const attrNameMatches = part.match(LAST_ATTR_NAME);
      if ( attrNameMatches && attrNameMatches.length > 1) {
        isAttr = true;
        if ( attrNameMatches[0].includes('"') ) {
          hasQuote = true;
        } else {
          hasQuote = false; 
        }
      } else {
        isAttr = false;
      }
      if ( isAttr && !hasQuote ) {
        part += '"';
      }
      if ( killFirstQuote ) {
        part = part.replace(/^\s*"(.)/,'$1'); 
        killFirstQuote = false;
      }
      const val = vals.shift();
      if ( typeof val == "function" ) {
        const attrNameMatches = part.match(LAST_ATTR_NAME);
        let realAttrName;
        let attrName;
        if ( attrNameMatches && attrNameMatches.length > 1) {
          attrName = realAttrName = attrNameMatches[1]; 
          attrName = attrName.replace(/^on/,'').toLowerCase();
        }
        const newPart = part.replace(attrNameMatches[0], '');
        const hid = 'hid:' + Math.random();
        handlers[hid] = [{
          eventName: attrName, handler: val
        },{
          eventName: realAttrName, handler: val
        }];
        str += newPart + (!!attrName ? ` data-hid="${hid}"` : '');
        killFirstQuote = attrNameMatches[0].includes('"');
      } else if ( !! val && val.handlers && val.str ) {
        Object.assign(handlers,val.handlers);
        str += part;
        str += val.str;
      } else {
        str += part;
        str += val;
      }
      if ( isAttr ) {
        const noQuoteEnding = str.match(/=\s*"[^"]*$/);
        //const quoteEnding = str.match(/=\s*"[^"]*"\s*$/); 
        if ( noQuoteEnding ) {
          str += '"';
        }
      }
    }
    str += parts.shift();
    return {str,handlers};
  }

  function save(o) {
    const s = JSON.stringify(o).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    return s;
  }

  function load(s) {
    const o = JSON.parse(s.replace(/&quot;/g,'"').replace(/&amp;/g,'&'), loadDate);
    return o;
  }

  function loadDate(k,v) {
    if (typeof v === "string" && DATE_MATCHER.test(v)) {
      return new Date(v);
    }
    return v;
  }

  function descendent(cls,superClass) {
    let {prototype} = cls;
    let checks = 0;
    while( !! prototype && checks < 100 ) {
      checks += 1;
      if ( prototype === superClass.prototype ) {
        return true;
      }
      prototype = Object.getPrototypeOf(prototype);
    }
    return false;
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o),loadDate);
  }

  function focusRecoverable(el) {
    return el.matches(MAYBE_CAN_FOCUS);
  }

  function getSelector(el) {
    const path = [];
    do {
      const level = `${el.localName}${
        el.id ? `#${el.id}` : ''
      }${ 
        el.name ? `[name="${el.name}"]` : ''
      }`;
      path.unshift( level );
      el = el.parentNode;
      if ( el == root ) break;
      if ( el == document ) break;
      if ( el.shadowHost ) {
        // since /deep/ and ::shadow were deprecated there's no way
        // to make a CSS selector from document work
        break;
      }
    } while(el);
    return path.join(' ');
  }
}

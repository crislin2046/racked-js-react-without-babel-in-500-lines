"use strict";
{
  let debug = false;

  const Racked = self.Racked || {};
  Object.assign(Racked,{render});

	function NumberList(props) {
		const numbers = props.numbers;
		const listItems = numbers.map((number) =>
			R`<li>${number}</li>`
		);
		return R`
			<ul>${listItems}</ul>
		`;
	}

	const numbers = [1, 2, 3, 4, 5];
	Racked.render(
		R`<NumberList numbers=${numbers} />`,
		document.getElementById('root')
	); 

  function render(markup, where, memory = {id_stack: [],roots:[], handlers:{}}) {
    const {id_stack:id_stack = [], roots:roots = [], handlers:mhandlers={}} = memory;
    Object.assign(memory,{id_stack,roots,handlers:mhandlers});
    let str, handlers;
    ({str:str=markup,handlers:handlers={}} = markup);
    Object.assign(memory.handlers,handlers);
    const rack = fc(str);
    let isClass = false;
    let component;
    if ( ! rack ) {
      return {str,handlers:memory.handlers};
    }

    const parser = document.createTreeWalker(rack,NodeFilter.SHOW_ALL);
    const stack = [];
    let html = '';

    do {
      const node = parser.currentNode;
      switch( node.nodeType ) {
        case Node.ELEMENT_NODE: {
          const name = node.tagName.toLowerCase();
          const CapitalizedNameIndex = str.toLowerCase().indexOf(name);
          let CapitalizedName = name;
          if ( CapitalizedNameIndex >= 0 ) {
            CapitalizedName = str.substr(CapitalizedNameIndex,name.length);
          }
          // see if it's a ract component (if there's a function called <CapitalizedName>))
          try {
            const props = Array.from(node.attributes)
              .reduce((all,{name,value}) => {
                if ( name.startsWith('data-hid') && value.startsWith('hid:') ) {
                  if ( !! memory.handlers[value] ) {
                    const func = memory.handlers[value][0].handler;
                    const name = memory.handlers[value][0].eventName;
                    const eventName = 'on' + name
                      .replace(/^\w/, c => c.toUpperCase());
                    all[eventName] = func;
                  }
                } else {
                  try {
                    all[name] = load(value);
                  } catch(e) {
                    debug ? console.warn(e,name,value) : void 0;
                    all[name] = value;
                  }
                }
                return all;
              },{});
            isClass = eval(`descendent(${CapitalizedName},Racked.Component)`);
            let componentRender, componentHtml;
            if ( isClass ) {
              component = eval(`new ${CapitalizedName}(props)`);
              componentRender = component.render(); 
              ({str:componentHtml=componentRender} = componentRender);
            } else {
              componentRender = eval(`${CapitalizedName}(props)`);
              ({str:componentHtml=componentRender} = componentRender);
            }
            Object.assign(memory.handlers, componentRender.handlers);
            const renderedAgainComponentHtml = render({
              str:componentHtml,
              handlers:componentRender.handlers
            },null,memory);
            if ( componentHtml !== renderedAgainComponentHtml.str ) {
              componentHtml = renderedAgainComponentHtml.str; 
            }
            if ( !! component ) {
              const currentComponent = component;
              const cfrag = df(componentHtml);
              try {
                const rid = cfrag.querySelector('[data-ractid]').dataset.ractid;
                memory.roots.push(() => {
                  const root = document.querySelector(`[data-ractid="${rid}"]`);
                  currentComponent.root = root;
                  currentComponent.componentDidMount();
                });
              } catch(e){
                debug ? console.warn(e) : void 0;
                currentComponent.root = where;
                currentComponent.noRactId = true;
              }
            }
            html += componentHtml;
            break;
          } catch(e) {
            debug ? console.warn(e) : void 0;
            // not a ract component so we need to close it
            stack.push(node);
            // and report it
            const id = 'id:' + Math.random();
            memory.id_stack.push({id});
            html += `<${name}${
              node.childElementCount ? ` data-ractid="${id}"` : ''}${
              node.attributes.length ? ' ' + Array.from(node.attributes)
                .map( attr => `${attr.name}="${attr.value}"` )
                .join(' ') : ''}>`;
            break;
          }
        }
        default: {
          if ( !! node.nodeValue ) {
            html += node.nodeValue || '';
            break;
            const renderedAgainComponentHtml = render({str:node.nodeValue,handlers},null,memory);
            if ( renderedAgainComponentHtml.str !== node.nodeValue ) {
              html += renderedAgainComponentHtml.str;
            } else {
              html += node.nodeValue || '';
            }
          }
          break;
        }
      }
      if ( ! node.nextSibling && ! node.childNodes.length ) {
        const parent = stack.pop(); 
        memory.id_stack.pop();
        if ( !! parent && ! VOID_ELEMENTS.has(parent.localName)) {
          // close it
          html += `</${parent.tagName.toLowerCase()}>`;
        }
      }
    } while(parser.nextNode());

    if ( isClass ) {
      component.componentDidMount();
    }
    let output;
    if ( ! where ) {
      output = {str:html,handlers};
    } else {
      where.innerHTML = html;
      memory.roots.forEach(f => f());
      Object.keys(memory.handlers).forEach( hid => {
        const node = document.querySelector(`[data-hid="${hid.replace(':', ":")}"]`);
        if ( !! node ) {
          memory.handlers[hid].forEach( ({eventName, handler}) => {
            node.addEventListener(eventName, handler);
          });
        }
      });
      output = {str:html,handlers};
    }
    return output;
  }
}

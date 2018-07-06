"use strict";
{
	let debug = false;

	const Racked = self.Racked || {};
	Object.assign(Racked,{render});

	function FancyBorder(props) {
		return R`
			<div className=${'FancyBorder FancyBorder-' + props.color}>
				${props.children}
			</div>
		`;
	}

	function WelcomeDialog() {
		return R`
			<FancyBorder color="blue">
				<h1 className="Dialog-title">
					Welcome
				</h1>
				<p className="Dialog-message">
					Thank you for visiting our spacecraft!
				</p>
			</FancyBorder>
		`;
	}

	Racked.render(
		R`<WelcomeDialog />`,
		document.getElementById('root')
	);

	function render(markup, where, memory = {roots:[], handlers:{}}) {
		const {roots:roots = [], handlers:mhandlers={}} = memory;
		Object.assign(memory,{roots,handlers:mhandlers});
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
					// see if it's a ract component (if there's a function / class called <CapitalizedName>))
					try {
						const props = Array.from(node.attributes)
							.reduce((all,{name,value}) => {
								if ( name.startsWith('data-hid') && value.startsWith('hid:') ) {
									if ( !! memory.handlers[value] ) {
                    memory.handlers[value].forEach( ({eventName,handler}) => {
                      const func = handler;
                      let name = eventName;
                      name = name.startsWith('on') ? name : ('on' + name
                        .replace(/^\w/, c => c.toUpperCase()));
                      all[name] = func;
                   });
									}
								} else if ( name == "classname" ) {
									node.setAttribute("class", value);
                  node.removeAttribute("classname");
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
            Object.assign(props,memory.handlers.props);
            let hasClosingTag = str.match(new RegExp(`</${CapitalizedName}`));
            let cid;
            if ( hasClosingTag ) {
              cid = "cid:"+Math.random();
              props.children = cid;
              stack.push({localName:CapitalizedName,cid});
            }
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
            if( hasClosingTag ) {
              memory[cid] = componentHtml;
            } else {
              html += componentHtml;
            }
						break;
					} catch(e) {
						debug ? console.warn(e) : void 0;
						// not a ract component so we need to close it if it's non-void
            if ( ! VOID_ELEMENTS.has(node.localName) ) {
              stack.push(node);
            }
						// and report it
						const id = 'id:' + Math.random();
						html += `<${name}${
							node.childElementCount ? ` data-ractid="${id}"` : ''}${
							node.attributes.length ? ' ' + Array.from(node.attributes)
								.map( attr => `${attr.name}="${attr.value}"` )
								.join(' ') : ''}>`;
						// controlled form "select" new code
							if ( name == 'select' && !! node.attributes.value ) {
								const selected = node.attributes.value.value;
								Array.from(node.querySelectorAll('*')).forEach( el => {
									if ( el.localName == 'option' && el.value == selected ) {
										el.setAttribute("selected","");
									}
								});
						}
						break;
					}
				}
				default: {
					if ( !! node.nodeValue ) {
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
        if ( !! parent && parent.cid ) {
          let rawHtml = memory[parent.cid];
          rawHtml = rawHtml.replace(parent.cid,html);
          html = rawHtml;
        }
        else if ( !! parent && ! VOID_ELEMENTS.has(parent.localName) ) {
          html += `</${parent.localName}>`;
        }
			}
		} while(parser.nextNode());

    while(stack.length) {
      let snode = stack.pop();
      if ( !! snode ) {
        if( ! VOID_ELEMENTS.has(parent.localName)) {
          html += `</${parent.localName}>`;
        }
        snode = stack.pop(); 
      }
    }

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
            component.props[eventName] = handler;
					});
				}
			});
			output = {str:html,handlers};
		}
		return output;
	}
}

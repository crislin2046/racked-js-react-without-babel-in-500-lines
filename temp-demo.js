"use strict";
{
	let debug = false;

	const Racked = self.Racked || {};
	Object.assign(Racked,{render});

	const scaleNames = {
		c: 'Celsius',
		f: 'Fahrenheit'
	};

	function toCelsius(fahrenheit) {
		return (fahrenheit - 32) * 5 / 9;
	}

	function toFahrenheit(celsius) {
		return (celsius * 9 / 5) + 32;
	}

	function tryConvert(temperature, convert) {
		const input = parseFloat(temperature);
		if (Number.isNaN(input)) {
			return '';
		}
		const output = convert(input);
		const rounded = Math.round(output * 1000) / 1000;
		return rounded.toString();
	}

	function BoilingVerdict(props) {
		if (props.celsius >= 100) {
			return R`<p>The water would boil.</p>`;
		}
		return R`<p>The water would not boil.</p>`;
	}

	class TemperatureInput extends Racked.Component {
		constructor(props) {
			super(props);
			this.handleChange = this.handleChange.bind(this);
		}

		handleChange(e) {
			this.props.onTemperatureChange(e.target.value);
		}

		render() {
			const temperature = this.props.temperature;
			const scale = this.props.scale;
			return R`
				<fieldset>
					<legend>Enter temperature in ${scaleNames[scale]}:</legend>
					<input value=${temperature}
								 onChange=${this.handleChange} />
				</fieldset>
			`;
		}
	}

	class Calculator extends Racked.Component {
		constructor(props) {
			super(props);
			this.handleCelsiusChange = this.handleCelsiusChange.bind(this);
			this.handleFahrenheitChange = this.handleFahrenheitChange.bind(this);
			this.state = {temperature: '', scale: 'c'};
		}

		handleCelsiusChange(temperature) {
			this.setState({scale: 'c', temperature});
		}

		handleFahrenheitChange(temperature) {
			this.setState({scale: 'f', temperature});
		}

		render() {
			const scale = this.state.scale;
			const temperature = this.state.temperature;
			const celsius = scale === 'f' ? tryConvert(temperature, toCelsius) : temperature;
			const fahrenheit = scale === 'c' ? tryConvert(temperature, toFahrenheit) : temperature;

			return R`
				<div>
					<TemperatureInput
						scale="c"
						temperature=${celsius}
						onTemperatureChange=${this.handleCelsiusChange} />
					<TemperatureInput
						scale="f"
						temperature=${fahrenheit}
						onTemperatureChange=${this.handleFahrenheitChange} />
					<BoilingVerdict
						celsius=${parseFloat(celsius)} />
				</div>
			`;
		}
	}

	Racked.render(
		R`<Calculator />`,
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
					// see if it's a ract component (if there's a function called <CapitalizedName>))
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
        if ( !! parent && ! VOID_ELEMENTS.has(parent.localName) ) {
          html += `</${parent.tagName.toLowerCase()}>`;
        }
			}
		} while(parser.nextNode());

    while(stack.length) {
      let snode = stack.pop();
      if ( !! snode ) {
        if( ! VOID_ELEMENTS.has(parent.localName)) {
          html += `</${parent.tagName.toLowerCase()}>`;
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

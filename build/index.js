const fs = require('fs');
const UXCore = require('uxcore');
const config = require('./config.json');

const isComponent = (c) => {
    return c.propTypes || c.displayName || c.defaultProps;
};

const walkThrough = (union, components, parentName) => {
    for (let name in union) {
        if (union.hasOwnProperty(name)) {
            let key = name;
            if (parentName
                && config.skipParentName.indexOf(parentName) === -1
                && name.indexOf(parentName) === -1) {
                key = `${parentName}.${name}`;
            }
            if (config.skip.indexOf(key) > -1) {
                continue;
            }
            if (components[key]) {
                continue;
            }
            if (!/^[A-Z]/.test(name)) {
                continue;
            }

            let component = union[name];
            if (!isComponent(component)) {
                if (component.default && isComponent(component.default)) {
                    component = component.default;
                } else {
                    continue;
                }
            }

            const { hasChildren, porps } = stringifyPropTypes(component.propTypes);

            components[key] = {
                hasChildren,
                alias: normalizeDisplayName(key),
                propTypes: porps,
                defaultProps: component.defaultProps,
            };

            walkThrough(component, components, name);
        }
    }
};

const normalizeDisplayName = (name) => {
    if (name) {
        name = name.replace('.', '');
        return name.replace(/[A-Z]/g, (c, i) => {
            return (i === 0 ? '' : '-') + c.toLowerCase();
        });
    }
    return name;
};

const stringifyPropTypes = (propTypes) => {
    let hasChildren = false;
    const props = {};

    for (let key in propTypes) {
        if (propTypes.hasOwnProperty(key)) {
            if (key === 'children') {
                hasChildren = true;
            } else {
                props[key] = null;
            }
        }
    }

    return {
        hasChildren,
        props,
    };
};

const convertPropsToHTML = (props) => {
    const html = [];
    const toString = Object.prototype.toString;

    let children;
    for (let key in props) {
        const value = props[key];

        if (key === 'children') {
            children = value;
            continue;
        }

        switch (toString.call(value)) {
            case '[object Number]':
                html.push(`${key}={${value}}`);
                break;
            case '[object Object]':
                if ('type' in value && 'key' in value && 'ref' in value) {
                    // jsx props
                    continue;
                }
                html.push(`${key}={${JSON.stringify(value)}}`);
                break;
            case '[object Boolean]':
                if (value) {
                    html.push(`${key}`);
                } else {
                    html.push(`${key}={${value}}`);
                }
                break;
            case '[object String]':
                html.push(`${key}="${value}"`);
                break;
            default:
                html.push(`${key}={}`);
                break;
        }
    }

    return {
        propsLength: html.length,
        propsHTML: html.join(`\n${config.tab}`),
        children,
    };
};

const components = {};

walkThrough(UXCore, components);

console.info("Find ", Object.keys(components).length, " components");

for (let key in components) {
    const component = components[key];
    const fileName = `../snippets/${component.alias}.sublime-snippet`;

    console.info(`Create ${component.alias}.sublime-snippet`);

    let { propsLength, propsHTML, children } = convertPropsToHTML(component.defaultProps);
    if (!children) {
        children = `\$1`;
    }

    let content = '';
    if (component.hasChildren) {
        if (propsLength) {
            if (propsLength > 1) {
                content = `<${key}
${config.tab}${propsHTML}
>
${config.tab}${children}
</${key}>`;
            } else {
                content = `<${key} ${propsHTML}>
${config.tab}${children}
</${key}>`;
            }
        } else {
            content = `<${key}>
${config.tab}${children}
</${key}>`;
        }

    } else {
        if (propsLength) {
            if (propsLength > 1) {
                content = `<${key}
${config.tab}${propsHTML}
/>`;
            } else {
                content = `<${key} ${propsHTML} />`;
            }
        } else {
            content = `<${key} />`;
        }
    }

    fs.writeFileSync(
        fileName,
        `<snippet>
${config.tab}<content><![CDATA[
${content}
]]></content>
${config.tab}<tabTrigger>${config.prefix}${component.alias}</tabTrigger>
</snippet>
`
    );
}
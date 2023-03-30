import { Group, GroupSerial, IFWrapper, Reader, Wrapper, WrapperSerial } from "./tokenizer"

// const lexer = new Wrapper('lexer')
// const lexer_block = new Wrapper('lexer.block')
// const hidden = new Reader('whitespace', /[\s\r\n]*/).set('ignore', true)
// const Hidden = new Reader('whitespace', /[\s\r\n]+/).set('ignore', true)
// const identifier = new Reader('identifier', /[_\w][_\w\d]*/)
// const expr = new Wrapper('expr')
// const expr_value = new Group('expr.value')
// const strings = new Wrapper('strings')
// const qouted_strings = new Wrapper("strings.qouted")
// const double_qouted_strings = new Wrapper("strings.double_qouted")
// const group = new Wrapper('group')
// const group_children = new Wrapper('group.children')
// const wrapper = new Wrapper('wrapper')
// const wrapper_children = new Wrapper('wrapper.children')
// const decorator = new Group('decorator')

// wrapper.add([
//     new Reader('wrapper.children.open', /\[/),
//     wrapper_children,
//     new Reader('wrapper.mode', /[\*\+\?]/)
//         .set("nullable", true)
// ])

// group.add([
//     new Reader('group.children.open', /\(/),
//     group_children,
//     new Reader('group.mode', /[\*\+\?]/)
//         .set("nullable", true)
// ])

// wrapper_children.add([
//     new GroupSerial('wrapper.children').add([
//         Hidden,
//         expr,
//     ]).set("nullable", true),
//     new Reader('wrapper.children.close', /\]/)
//         .set("pop", true)
// ])

// group_children.add([
//     new GroupSerial('group.children').add([
//         Hidden,
//         expr,
//     ]).set("nullable", true),
//     new Reader('group.children.close', /\)/)
//         .set("pop", true)
// ])

// const if_stats = new Wrapper('if')
// const if_stats_block = new Wrapper('if.block')

// const header = new Wrapper('header').add([
//     new Reader('hashtag', /#/),
//     new Reader('content', /[^\r\n]*/)
// ])

// decorator.add([
//     new Wrapper('bind').add([
//         new Reader('lexer.bind', /\@bind/),
//         hidden,
//         new Reader('lexer.bind.punctuation.open', /\(/),
//         hidden,
//         new Reader('lexer.bind.name', /([\w][_\w\d]*)\:([\w][_\w\d]*)|([\w][_\w\d]*)/),
//         hidden,
//         new Reader('lexer.bind.punctuation.close', /\)/),
//         Hidden
//     ]),
//     new Wrapper('merge').add([
//         new Reader('lexer.merge', /\@merge/),
//         Hidden
//     ]),
// ])

// lexer.add([
//     new Reader('lexer.keyword', /lexer/),
//     Hidden,
//     identifier.New('lexer.name'),
//     hidden,
//     new Reader('lexer.block.open', /\{/),
//     lexer_block
// ])

// lexer_block.add([
//     new GroupSerial('lexer.context').add([
//         lexer,
//         expr,
//         Hidden,
//         if_stats,
//         decorator.ignore(["bind"]),
//         group,
//         wrapper
//     ]).set("nullable", true),
//     new Reader('lexer.block.close', /\}/).set("pop", true)
// ])

// expr.add([
//     identifier.New('expr.variable'),
//     hidden,
//     new Reader('expr.assignment', /=/),
//     hidden,
//     expr_value,
//     new WrapperSerial('expr.value').add([
//         Hidden,
//         expr_value
//     ]).set("nullable", true),
//     hidden,
//     new IFWrapper('expr.options', new Reader('expr.options.start.check', /->/)).add([
//         new Reader('expr.options.start', /->/),
//         hidden,
//         new Wrapper('expr.options.option').add([
//             identifier,
//             new IFWrapper('expr.options.option.punctuation.open.check', new Reader('expr.options.option.punctuation.open', /\(/)).add([
//                 new Reader('expr.options.option.punctuation.open', /\(/),
//                 identifier,
//                 new Reader('expr.options.option.punctuation.close', /\)/)
//             ])
//         ])
//     ]),
//     new Reader('expr.end', /\;/)
// ])

// expr_value.add([
//     identifier.New('lexer.name'),
//     strings,
//     new Reader('cardboard.metadata', /\@(?:[_\w][_\w\d]*)(?:\.(?:[_\w][_\w\d]*))*/),
//     group,
//     wrapper
// ])

// if_stats.add([
//     new Reader('if.keyword', /\@if/),
//     hidden,
//     new Reader('if.condition.open', /\(/),
//     hidden,
//     strings,
//     hidden,
//     new Reader('if.condition.close', /\)/),
//     hidden,
//     new Reader('if.block.open', /\{/),
//     if_stats_block,
//     hidden,
//     new IFWrapper('if.block.stop.check', new Reader('if.block.stop.check', /\-\>/)).add([
//         new Reader('if.block.stop.start', /\-\>/),
//         hidden,
//         new Reader('if.block.stop', /end/)
//     ])
// ])

// if_stats_block.add([
//     new GroupSerial('lexer.context').add([
//         expr,
//         Hidden,
//         if_stats,
//         group,
//         wrapper
//     ]).set("nullable", true),
//     new Reader('if.block.close', /\}/),
// ])

// strings.add([
//     new IFWrapper('strings.double_qouted', new Reader('strings.double_qouted.open', /\"/)).add([
//         double_qouted_strings
//     ]).set("stop", true),
//     qouted_strings,
// ]).set("merge", true)

// qouted_strings.add([
//     new Reader('strings.qouted.open', /\'/),
//     new Wrapper('strings.qouted.text').add([
//         new GroupSerial('strings.text').add([
//             new Reader("text", /[^\\\'\n\r]+/),
//             new Reader("escape", /\\[tbrn\"\'\\]/)
//         ]).set("nullable", true),
//         new Wrapper('test').add([
//             new Reader('strings.qouted.close', /\'/)
//         ]),
//     ])
// ])

// double_qouted_strings.add([
//     new Reader('strings.double_qouted.open', /\"/),
//     new Wrapper('strings.double_qouted.text').add([
//         new GroupSerial('strings.text').add([
//             new Reader("text", /[^\\\"\r\n\t]+/),
//             new Reader("escape", /\\[tbrn\"\'\\\[\]\(\)\{\}]/),
//         ]).set("nullable", true),
//         new Reader('strings.double_qouted.close', /\"/)
//     ])
// ])

// export const box = new GroupSerial("box", [
//     header.set("merge", true),
//     lexer,
//     decorator,
//     Hidden,
// ])


const hidden = new Reader('whitespace', /[\s\r\n]*/).set('ignore', true)
const Hidden = new Reader('whitespace', /[\s\r\n]+/).set('ignore', true)

const group = new Wrapper("group")
const content = new Wrapper("content")
const test = new IFWrapper("name", new Reader("name.test", /\w+/), [
    new Reader("name", /\w+/)
])
group.add([
    new Reader("group.open", /\(/),
    test.set("stop",true),
    hidden,
    group.New().set("nullable", true),
    hidden,
    new Reader("group.close", /\)/),
])

content.add(group.New()).set("nullable", true)

export const box = new GroupSerial("box", [
    group,
    Hidden,
])

// console.log((box as any).children[0].children[2])
import { Input } from "./input"

export type Range = [number, number]

export type Location = {
    line: number
    column: number
}

export type Span = {
    start: Location
    end: Location
    range: Range
    size: number
}

export class Token {
    name: string
    value: string
    span: Span

    constructor(name: string, raw: string, span: Span) {
        this.name = name
        this.value = raw
        this.span = span
    }
}

export interface TnzOptionsNormal {
    mode: "normal"
    fragment: boolean
    ignore: boolean
    nullable: boolean
}

export interface TnzOptionsPush {
    mode: "push"
    ignore: boolean
    nullable: boolean
    tokenizer: Tokenizer
}

export interface TnzOptionsPop {
    mode: "pop"
    ignore: boolean
    nullable: boolean
}

export type TnzOptions = TnzOptionsNormal | TnzOptionsPush | TnzOptionsPop

enum _PackStatus {
    succeed,
    fail,
    unprocess,
    processing
}

enum _TnzType {
    Unassign,
    Reader,
    Wrapper,
    WrapperSerial,
    IFWrapper,
    Group,
    GroupSerial
}

export type TnzType = keyof typeof _TnzType;
export type PackStatus = keyof typeof _PackStatus;

export function is_pack(tnz: Tokenizer) {
    return (["Group", "GroupSerial", "Wrapper", "IFWrapper", "WrapperSerial"] as TnzType[]).includes(tnz.type)
}

export interface Lexer<MappedToken = any> {
    queue: Tokenizer[]
    scheme: Tokenizer[]
    tokens: (Token | MappedToken)[]
    source: Input
    index: number
    tokenMapper?: (name:string,value:string,span:Span) => MappedToken
}

export interface Tokenizer {
    type: TnzType;
    name: string;
    parent: IPack | undefined

    options: TnzOptions

    test(lexer: Lexer): boolean
    read(lexer: Lexer): Token
    set(options: TnzOptions): Tokenizer
    clone(options?: TnzOptions): Tokenizer
}

export interface IPack extends Tokenizer {
    index: number
    next(): Tokenizer
    children: Tokenizer[]
    ended: boolean
    status: PackStatus
    del(): any
}
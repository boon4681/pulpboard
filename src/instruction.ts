import { Input } from "./input";
import { Memory } from "./memo"
import { Lexer, Reader, Tokenizer, TokenizerType } from "./tokenizer"

export enum InstructionType {
    PUSH,
    POP,
    NEP,
    READ,
    TEST,
    SET,
    CMP,
    SKIP,
    SIT,
    SIF,
    END,
    SADD,
    STACK,
}

export interface Instruction {
    type: InstructionType;
    str(): string
}

export class PUSH implements Instruction {
    type = InstructionType.PUSH
    constructor(
        public tokenizer: Tokenizer
    ) { }
    str(): string {
        return this.tokenizer.name
    }
}

export class POP implements Instruction {
    type = InstructionType.POP
    constructor(
    ) { }
    str(): string {
        return ''
    }
}

export class NEP implements Instruction {
    type = InstructionType.NEP
    constructor(
        public mov: number
    ) { }
    str(): string {
        return '' + this.mov
    }
}

export class READ implements Instruction {
    type = InstructionType.READ
    constructor(
        public reader: Tokenizer,
        public variable: string
    ) { }
    str(): string {
        return this.reader.name + ', ' + this.variable
    }
}

export class TEST implements Instruction {
    type = InstructionType.TEST
    constructor(
        public tester: Tokenizer,
        public variable: string
    ) { }
    str(): string {
        return this.tester.name + ', ' + this.variable
    }
}

export class SET implements Instruction {
    type = InstructionType.SET
    constructor(
        public address: string,
        public data: number
    ) { }
    str(): string {
        return this.address + ', ' + this.data
    }
}

export class CMP implements Instruction {
    type = InstructionType.CMP
    constructor(
        public address_a: number | string,
        public address_b: number | string
    ) { }
    str(): string {
        let a = this.address_a
        let b = this.address_b
        return a + ', ' + b
    }
}

export class SKIP implements Instruction {
    type = InstructionType.SKIP
    constructor(
        public mov: number
    ) { }
    str(): string {
        return this.mov + ''
    }
}

export class SIT implements Instruction {
    type = InstructionType.SIT
    constructor(
        public mov: number
    ) { }
    str(): string {
        return this.mov + ''
    }
}

export class SIF implements Instruction {
    type = InstructionType.SIF
    constructor(
        public mov: number
    ) { }
    str(): string {
        return this.mov + ''
    }
}

export class END implements Instruction {
    type = InstructionType.END
    constructor() { }
    str(): string {
        return ''
    }
}

export class SADD implements Instruction {
    type = InstructionType.SADD
    constructor() { }
    str(): string {
        return ''
    }
}

export class STACK implements Instruction {
    type = InstructionType.STACK

    constructor(
        public name: string,
        public start: number,
        public size: number,
        public pointer: number
    ) { }
    str(): string {
        return this.name
    }
}
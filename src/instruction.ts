import { Input } from "./input";
import { Address, Memory } from "./memo"
import { Lexer, Reader, Tokenizer, TokenizerType } from "./tokenizer"

export enum InstructionType {
    PUSH,
    POP,
    NEP,
    READ,
    TEST,
    ADD,
    SET,
    CMP,
    ICMP,
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

export class ADD implements Instruction {
    type = InstructionType.ADD
    constructor(
        public address: Address
    ) { }
    str(): string {
        return this.address.location + ', ' + this.address.assigned
    }
}

export class SET implements Instruction {
    type = InstructionType.SET
    constructor(
        public address: Address
    ) { }
    str(): string {
        return this.address.location + ', ' + this.address.assigned
    }
}

export class CMP implements Instruction {
    type = InstructionType.CMP
    constructor(
        public address_a: Address | number | string,
        public address_b: Address | number | string
    ) { }
    str(): string {
        let a
        let b
        if (this.address_a instanceof Address) a = this.address_a.location
        else a = this.address_a
        if (this.address_b instanceof Address) b = this.address_b.location
        else b = this.address_b
        return a + ', ' + b
    }
}

export class ICMP implements Instruction {
    type = InstructionType.ICMP
    constructor(
        public id: number,
    ) { }
    str(): string {
        return this.id.toString()
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
        public inst: Instruction[]
    ) { }
    str(): string {
        return this.name
    }
}
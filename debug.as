PUSH box
    PUSH group
        READ group.open, A
        CMP A, 1
        SIF 70
        SADD
        TEST name.test, A
        CMP A, 1
        SIF 8
        PUSH name
            READ name, A
            CMP A, 1
            SIF 3
            SADD
        POP
        SIF 1
        NEP
        SADD
        READ whitespace, A
        CMP A, 1
        SIF 54
        SADD
        PUSH group
            READ group.open, A
            CMP A, 1
            SIF 28
            SADD
            TEST name.test, A
            CMP A, 1
            SIF 8
            PUSH name
                READ name, A
                CMP A, 1
                SIF 3
                SADD
            POP
            SIF 1
            NEP
            SADD
            READ whitespace, A
            CMP A, 1
            SIF 12
            SADD
            ADD m3, 1
            SKIP -24
            SADD
            READ whitespace, A
            CMP A, 1
            SIF 16
            SADD
            READ group.close, A
            CMP A, 1
            SIF 12
            SADD
        POP
        CMP m3, 0
        SIT 9
        ICMP 0
        SIT 4
        ICMP 0
        SIT 2
    POP
    SIF -6
    ADD m3, -1
    CMP m3, -1
    SIF 0
    SADD
    READ whitespace, A
    CMP A, 1
    SIF 5
    SADD
    READ group.close, A
    CMP A, 1
    SIF 1
    SADD
POP
SIT 5
SADD
READ whitespace, A
CMP A, 1
SIT 5
SADD
SIF 1
SET B, 1
POP
CMP B, 1
SET B, 0
SIT -88
END
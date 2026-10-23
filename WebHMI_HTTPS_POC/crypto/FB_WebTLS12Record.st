(*
 FB_WebTLS12Record - TLS 1.2 AES_128_GCM application_data RECORD LAYER.
 DEPENDENCIES (all in ST): FB_WebAESGCM, FB_WebAES128.
 This handles encrypted records ONLY AFTER a real authenticated TLS handshake
 has established the read/write keys, 4-byte fixed IVs and sequence counters.
 TLS HANDSHAKE, CERTIFICATE AUTH, ECDHE AND CSPRNG ARE NOT IMPLEMENTED.
 DO NOT PUT PRE-SHARED OR STATIC SESSION KEYS INTO MACHINE PROGRAM.
 DO NOT ACCEPT RECORDS AS APPLICATION DATA BEFORE HANDSHAKE AUTHENTICATION.
 CRYPTO RESEARCH / LAB ONLY, not a deployable HTTPS server.
 *)
FUNCTION_BLOCK FB_WebTLS12Record
VAR_INPUT
    Execute : BOOL;
    Encrypt : BOOL;
    Key : ARRAY[0..15] OF BYTE;
    FixedIV : ARRAY[0..3] OF BYTE;
    Sequence : ARRAY[0..7] OF BYTE;
    Input : ARRAY[0..2076] OF BYTE;
    InputLen : UINT;
    Plain : ARRAY[0..2047] OF BYTE;
    PlainLen : UINT;
END_VAR
VAR_OUTPUT
    Done : BOOL;
    Busy : BOOL;
    Error : BOOL;
    Valid : BOOL;
    Output : ARRAY[0..2076] OF BYTE;
    OutputLen : UINT;
END_VAR
VAR
    State : UINT := 0;
    Gcm : FB_WebAESGCM;
    GcmStart : BOOL;
    Nonce : ARRAY[0..11] OF BYTE;
    Aad : ARRAY[0..31] OF BYTE;
    GcmData : ARRAY[0..2047] OF BYTE;
    GcmTag : ARRAY[0..15] OF BYTE;
    GcmDataLen : UINT;
    RecordLen : UINT;
    I : UINT;
    J : UINT;
END_VAR

Gcm(Execute:=GcmStart, Encrypt:=Encrypt, Key:=Key,
    Nonce:=Nonce, AAD:=Aad, AadLen:=UINT#13,
    Data:=GcmData, DataLen:=GcmDataLen, TagIn:=GcmTag);

IF (NOT Execute) AND (NOT Busy) THEN
    State := UINT#0;
    Done := FALSE;
    Error := FALSE;
    Valid := FALSE;
END_IF;

CASE State OF
    0:
        IF Execute THEN
            Done := FALSE;
            Valid := FALSE;
            Error := FALSE;
            Busy := TRUE;
            OutputLen := UINT#0;
            GcmStart := FALSE;
            IF Encrypt THEN
                IF PlainLen > UINT#2048 THEN
                    Error := TRUE;
                    Busy := FALSE;
                    State := UINT#100;
                ELSE
                    GcmDataLen := PlainLen;
                    FOR I := UINT#0 TO UINT#7 DO Nonce[UINT#4+I] := Sequence[I]; END_FOR;
                    FOR I := UINT#0 TO UINT#3 DO Nonce[I] := FixedIV[I]; END_FOR;
                    FOR I := UINT#0 TO GcmDataLen - UINT#1 DO
                        GcmData[I] := Plain[I];
                    END_FOR;
                    State := UINT#10;
                END_IF;
            ELSE
                (* RFC 5288: header 5 + explicit nonce 8 + tag 16. *)
                IF InputLen < UINT#29 THEN
                    Error := TRUE;
                    Busy := FALSE;
                    State := UINT#100;
                ELSE
                    RecordLen := SHL(BYTE_TO_UINT(Input[3]), UINT#8) + BYTE_TO_UINT(Input[4]);
                    IF (Input[0] <> BYTE#16#17) OR
                       (Input[1] <> BYTE#16#03) OR
                       (Input[2] <> BYTE#16#03) OR
                       (RecordLen < UINT#24) OR
                       (RecordLen > UINT#2072) OR
                       (InputLen <> RecordLen+UINT#5) THEN
                        Error := TRUE;
                        Busy := FALSE;
                        State := UINT#100;
                    ELSE
                        GcmDataLen := RecordLen - UINT#24;
                        FOR I := UINT#0 TO UINT#3 DO Nonce[I] := FixedIV[I]; END_FOR;
                        FOR I := UINT#0 TO UINT#7 DO Nonce[UINT#4+I] := Input[UINT#5+I]; END_FOR;
                        FOR I := UINT#0 TO GcmDataLen-UINT#1 DO
                            GcmData[I] := Input[UINT#13+I];
                        END_FOR;
                        FOR I := UINT#0 TO UINT#15 DO
                            GcmTag[I] := Input[UINT#13+GcmDataLen+I];
                        END_FOR;
                        State := UINT#10;
                    END_IF;
                END_IF;
            END_IF;
        END_IF;
    10:
        (* AAD: seq64, content-type application_data, TLS 1.2, plaintext length. *)
        FOR I := UINT#0 TO UINT#7 DO Aad[I] := Sequence[I]; END_FOR;
        Aad[8] := BYTE#16#17;
        Aad[9] := BYTE#16#03;
        Aad[10] := BYTE#16#03;
        Aad[11] := UINT_TO_BYTE(SHR(GcmDataLen,UINT#8));
        Aad[12] := UINT_TO_BYTE(GcmDataLen);
        GcmStart := TRUE;
        State := UINT#20;
    20:
        IF Gcm.Done THEN
            GcmStart := FALSE;
            IF (NOT Gcm.Error) AND Gcm.Valid THEN
                Valid := TRUE;
                IF Encrypt THEN
                    RecordLen := GcmDataLen + UINT#24;
                    Output[0] := BYTE#16#17;
                    Output[1] := BYTE#16#03;
                    Output[2] := BYTE#16#03;
                    Output[3] := UINT_TO_BYTE(SHR(RecordLen,UINT#8));
                    Output[4] := UINT_TO_BYTE(RecordLen);
                    FOR I := UINT#0 TO UINT#7 DO Output[UINT#5+I] := Sequence[I]; END_FOR;
                    FOR I := UINT#0 TO GcmDataLen-UINT#1 DO
                        Output[UINT#13+I] := Gcm.Result[I];
                    END_FOR;
                    FOR I := UINT#0 TO UINT#15 DO Output[UINT#13+GcmDataLen+I] := Gcm.Tag[I]; END_FOR;
                    OutputLen := RecordLen + UINT#5;
                ELSE
                    FOR I := UINT#0 TO GcmDataLen-UINT#1 DO
                        Output[I] := Gcm.Result[I];
                    END_FOR;
                    OutputLen := GcmDataLen;
                END_IF;
            ELSE
                Error := TRUE;
                Valid := FALSE;
                OutputLen := UINT#0;
            END_IF;
            Busy := FALSE;
            Done := TRUE;
            State := UINT#100;
        END_IF;
    100:
        (* Ready for another record when Execute drops. *)
    ELSE
        Error := TRUE;
        Busy := FALSE;
        State := UINT#100;
END_CASE;
END_FUNCTION_BLOCK

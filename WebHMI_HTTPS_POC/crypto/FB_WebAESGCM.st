(*
 FB_WebAESGCM - AEAD AES-128-GCM building block for future TLS record layer.
 Requires FB_WebAES128 (pure ST). Does not establish TLS sessions.
 No secrets embedded. No plaintext is declared authenticated on tag failure.
 FIPS 800-38D 96-bit nonce only; AAD max32, Data max2048 bytes.
 8 GHASH bit-steps per PLC scan: benchmark before operational use.
 ZERO guarantee of constant-time behavior on this PLC. LAB ONLY.
 *)
FUNCTION_BLOCK FB_WebAESGCM
VAR_INPUT
    Execute : BOOL;
    Encrypt : BOOL;
    Key : ARRAY[0..15] OF BYTE;
    Nonce : ARRAY[0..11] OF BYTE;
    AAD : ARRAY[0..31] OF BYTE;
    AadLen : UINT;
    Data : ARRAY[0..2047] OF BYTE;
    DataLen : UINT;
    TagIn : ARRAY[0..15] OF BYTE;
END_VAR
VAR_OUTPUT
    Done : BOOL;
    Busy : BOOL;
    Error : BOOL;
    Valid : BOOL;
    Result : ARRAY[0..2047] OF BYTE;
    Tag : ARRAY[0..15] OF BYTE;
END_VAR
VAR
    State : UINT := 0;
    AES : FB_WebAES128;
    AesStart : BOOL;
    AesInput : ARRAY[0..15] OF BYTE;
    HashKey : ARRAY[0..15] OF BYTE;
    TagMask : ARRAY[0..15] OF BYTE;
    Y : ARRAY[0..15] OF BYTE;
    Z : ARRAY[0..15] OF BYTE;
    V : ARRAY[0..15] OF BYTE;
    OldV : ARRAY[0..15] OF BYTE;
    CipherBlock : ARRAY[0..15] OF BYTE;
    AadOffset : UINT;
    BlockOffset : UINT;
    BitIndex : UINT;
    BitStep : UINT;
    J : UINT;
    I : UINT;
    B : BYTE;
    Mask : BYTE;
    Lsb : BOOL;
    Diff : BYTE;
    N : UINT;
    Counter : UDINT;
    AadBits : UDINT;
    DataBits : UDINT;
END_VAR

(* The nested AES function block is called on every PLC cycle. *)
AES(Execute:=AesStart, Key:=Key, InputBlock:=AesInput);

IF (NOT Execute) AND (NOT Busy) THEN
    Done := FALSE;
    Valid := FALSE;
    Error := FALSE;
    State := UINT#0;
END_IF;

CASE State OF
    0:
        IF Execute THEN
            Error := (AadLen > UINT#32) OR (DataLen > UINT#2048);
            Done := FALSE;
            Valid := FALSE;
            IF Error THEN
                Busy := FALSE;
                State := UINT#100;
            ELSE
                Busy := TRUE;
                AesStart := FALSE;
                AadOffset := UINT#0;
                BlockOffset := UINT#0;
                AadBits := UINT_TO_UDINT(AadLen) * UDINT#8;
                DataBits := UINT_TO_UDINT(DataLen) * UDINT#8;
                FOR I := UINT#0 TO UINT#15 DO
                    Y[I] := BYTE#0;
                    AesInput[I] := BYTE#0;
                END_FOR;
                (* E(K, zero) is GHASH authentication subkey. *)
                AesStart := TRUE;
                State := UINT#10;
            END_IF;
        END_IF;
    10:
        IF AES.Done THEN
            FOR I := UINT#0 TO UINT#15 DO HashKey[I] := AES.OutputBlock[I]; END_FOR;
            AesStart := FALSE;
            State := UINT#11;
        END_IF;
    11:
        (* J0 = 96-bit nonce || 0x00000001. *)
        FOR I := UINT#0 TO UINT#11 DO AesInput[I] := Nonce[I]; END_FOR;
        AesInput[12] := BYTE#0; AesInput[13] := BYTE#0;
        AesInput[14] := BYTE#0; AesInput[15] := BYTE#1;
        AesStart := TRUE;
        State := UINT#12;
    12:
        IF AES.Done THEN
            FOR I := UINT#0 TO UINT#15 DO TagMask[I] := AES.OutputBlock[I]; END_FOR;
            AesStart := FALSE;
            State := UINT#20;
        END_IF;
    20:
        IF AadOffset < AadLen THEN
            FOR I := UINT#0 TO UINT#15 DO
                B := BYTE#0;
                IF AadOffset+I < AadLen THEN B := AAD[AadOffset+I]; END_IF;
                Y[I] := Y[I] XOR B;
                V[I] := HashKey[I];
                Z[I] := BYTE#0;
            END_FOR;
            BitIndex := UINT#0;
            State := UINT#21;
        ELSE
            State := UINT#30;
        END_IF;
    21:
        (* GHASH for padded associated-data block; common worker below. *)
        ;

    30:
        IF BlockOffset < DataLen THEN
            (* GCM inc32(J0): first counter is 2; 96-bit nonce fixed. *)
            Counter := UDINT#2 + UINT_TO_UDINT(BlockOffset / UINT#16);
            FOR I := UINT#0 TO UINT#11 DO AesInput[I] := Nonce[I]; END_FOR;
            AesInput[12] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(Counter),UINT#24));
            AesInput[13] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(Counter),UINT#16));
            AesInput[14] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(Counter),UINT#8));
            AesInput[15] := UDINT_TO_BYTE(Counter);
            AesStart := TRUE;
            State := UINT#31;
        ELSE
            (* Final GHASH block: len(AAD)64 || len(cipher)64, both bits. *)
            FOR I := UINT#0 TO UINT#15 DO CipherBlock[I] := BYTE#0; END_FOR;
            CipherBlock[4] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(AadBits),UINT#24));
            CipherBlock[5] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(AadBits),UINT#16));
            CipherBlock[6] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(AadBits),UINT#8));
            CipherBlock[7] := UDINT_TO_BYTE(AadBits);
            CipherBlock[12] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(DataBits),UINT#24));
            CipherBlock[13] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(DataBits),UINT#16));
            CipherBlock[14] := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(DataBits),UINT#8));
            CipherBlock[15] := UDINT_TO_BYTE(DataBits);
            FOR I := UINT#0 TO UINT#15 DO
                Y[I] := Y[I] XOR CipherBlock[I];
                V[I] := HashKey[I];
                Z[I] := BYTE#0;
            END_FOR;
            BitIndex := UINT#0;
            State := UINT#41;
        END_IF;
    31:
        IF AES.Done THEN
            FOR I := UINT#0 TO UINT#15 DO
                CipherBlock[I] := BYTE#0;
                IF BlockOffset+I < DataLen THEN
                    Result[BlockOffset+I] := Data[BlockOffset+I] XOR AES.OutputBlock[I];
                    IF Encrypt THEN
                        CipherBlock[I] := Result[BlockOffset+I];
                    ELSE
                        CipherBlock[I] := Data[BlockOffset+I];
                    END_IF;
                END_IF;
            END_FOR;
            AesStart := FALSE;
            FOR I := UINT#0 TO UINT#15 DO
                Y[I] := Y[I] XOR CipherBlock[I];
                V[I] := HashKey[I];
                Z[I] := BYTE#0;
            END_FOR;
            BitIndex := UINT#0;
            State := UINT#32;
        END_IF;
    32:
        (* GHASH ciphertext block. *)
        ;

    41:
        (* GHASH length block. *)
        ;

    42:
        Diff := BYTE#0;
        FOR I := UINT#0 TO UINT#15 DO
            Tag[I] := TagMask[I] XOR Y[I];
            IF NOT Encrypt THEN Diff := Diff OR (Tag[I] XOR TagIn[I]); END_IF;
        END_FOR;
        Valid := Encrypt OR (Diff = BYTE#0);
        Error := NOT Valid;
        IF NOT Valid THEN
            (* Wipe unverified plaintext. Application MUST inspect Valid. *)
            FOR I := UINT#0 TO UINT#2047 DO Result[I] := BYTE#0; END_FOR;
        END_IF;
        Busy := FALSE;
        Done := TRUE;
        State := UINT#100;
    100:
        (* Wait for the Execute input to drop. *)
    ELSE
        Error := TRUE;
        Busy := FALSE;
        State := UINT#100;
END_CASE;

IF (State = UINT#21) OR (State = UINT#32) OR (State = UINT#41) THEN
    (* GHASH: 128-bit multiplication in GF(2^128).
       Accumulation is MSB-first, as specified in NIST SP 800-38D.
       This is NOT constant-time on all PLC runtimes. *)
    FOR BitStep := UINT#0 TO UINT#7 DO
        IF BitIndex < UINT#128 THEN
            Mask := SHR(BYTE#16#80, BitIndex MOD UINT#8);
            IF (Y[BitIndex / UINT#8] AND Mask) <> BYTE#0 THEN
                FOR J := UINT#0 TO UINT#15 DO Z[J] := Z[J] XOR V[J]; END_FOR;
            END_IF;
            Lsb := (V[15] AND BYTE#1) <> BYTE#0;
            FOR J := UINT#0 TO UINT#15 DO OldV[J] := V[J]; END_FOR;
            FOR J := UINT#0 TO UINT#15 DO
                V[J] := SHR(OldV[J],UINT#1);
                IF J > UINT#0 THEN
                    V[J] := V[J] OR SHL(OldV[J-UINT#1] AND BYTE#1,UINT#7);
                END_IF;
            END_FOR;
            IF Lsb THEN V[0] := V[0] XOR BYTE#16#e1; END_IF;
            BitIndex := BitIndex + UINT#1;
        END_IF;
    END_FOR;
    IF BitIndex = UINT#128 THEN
        FOR I := UINT#0 TO UINT#15 DO Y[I] := Z[I]; END_FOR;
        CASE State OF
            21:
                AadOffset := AadOffset + UINT#16;
                State := UINT#20;
            32:
                BlockOffset := BlockOffset + UINT#16;
                State := UINT#30;
            41:
                State := UINT#42;
        END_CASE;
    END_IF;
END_IF;
END_FUNCTION_BLOCK

(*
 FB_WebTLS12PRF - TLS 1.2 P_SHA256(secret, seed).
 Pure Structured Text, NO external runtime, depends on FB_WebHMACSHA256.
 Seed must already contain the ASCII TLS label concatenated with the byte seed:
   master secret: label 'master secret' || ClientRandom || ServerRandom
   key expansion: label 'key expansion' || ServerRandom || ClientRandom
 Supports up to 128 output bytes, secret <=64, seed <=128.
 Not the TLS handshake or CSPRNG. LAB ONLY, Sysmac unverified.
 *)
FUNCTION_BLOCK FB_WebTLS12PRF
VAR_INPUT
    Execute : BOOL;
    Secret : ARRAY[0..63] OF BYTE;
    SecretLen : UINT;
    Seed : ARRAY[0..127] OF BYTE;
    SeedLen : UINT;
    Requested : UINT;
END_VAR
VAR_OUTPUT
    Done : BOOL;
    Busy : BOOL;
    Error : BOOL;
    Result : ARRAY[0..127] OF BYTE;
END_VAR
VAR
    State : UINT := 0;
    Hmac : FB_WebHMACSHA256;
    HmacStart : BOOL;
    HmacInput : ARRAY[0..1919] OF BYTE;
    HmacInputLen : UINT;
    A : ARRAY[0..31] OF BYTE;
    Written : UINT;
    I : UINT;
    CopyLen : UINT;
END_VAR
Hmac(Execute:=HmacStart, Key:=Secret, KeyLen:=SecretLen,
     Message:=HmacInput, MessageLen:=HmacInputLen);

IF (NOT Execute) AND (NOT Busy) THEN
    Done := FALSE;
    Error := FALSE;
    State := UINT#0;
END_IF;

CASE State OF
    0:
        IF Execute THEN
            Done := FALSE;
            Error := (SecretLen > UINT#64) OR (SeedLen > UINT#128) OR
                     (Requested > UINT#128);
            IF Error THEN
                Busy := FALSE;
                State := UINT#100;
            ELSIF Requested = UINT#0 THEN
                Busy := FALSE;
                Done := TRUE;
                State := UINT#100;
            ELSE
                Busy := TRUE;
                Written := UINT#0;
                HmacInputLen := SeedLen;
                IF SeedLen > UINT#0 THEN
                    FOR I:=UINT#0 TO SeedLen-UINT#1 DO HmacInput[I] := Seed[I]; END_FOR;
                END_IF;
                HmacStart := TRUE;
                State := UINT#10;
            END_IF;
        END_IF;
    10:
        IF Hmac.Done THEN
            FOR I:=UINT#0 TO UINT#31 DO A[I] := Hmac.Digest[I]; END_FOR;
            HmacStart := FALSE;
            State := UINT#11;
        END_IF;
    11:
        (* P(n) = HMAC(secret, A(n) || seed). *)
        FOR I:=UINT#0 TO UINT#31 DO HmacInput[I] := A[I]; END_FOR;
        IF SeedLen > UINT#0 THEN
            FOR I:=UINT#0 TO SeedLen-UINT#1 DO
                HmacInput[UINT#32+I] := Seed[I];
            END_FOR;
        END_IF;
        HmacInputLen := UINT#32 + SeedLen;
        HmacStart := TRUE;
        State := UINT#12;
    12:
        IF Hmac.Done THEN
            CopyLen := Requested-Written;
            IF CopyLen > UINT#32 THEN CopyLen := UINT#32; END_IF;
            FOR I:=UINT#0 TO CopyLen-UINT#1 DO
                Result[Written+I] := Hmac.Digest[I];
            END_FOR;
            Written := Written + CopyLen;
            HmacStart := FALSE;
            IF Written = Requested THEN
                Done := TRUE;
                Busy := FALSE;
                State := UINT#100;
            ELSE
                State := UINT#21;
            END_IF;
        END_IF;
    21:
        (* A(n+1) = HMAC(secret, A(n)). *)
        FOR I:=UINT#0 TO UINT#31 DO HmacInput[I] := A[I]; END_FOR;
        HmacInputLen := UINT#32;
        HmacStart := TRUE;
        State := UINT#22;
    22:
        IF Hmac.Done THEN
            FOR I:=UINT#0 TO UINT#31 DO A[I] := Hmac.Digest[I]; END_FOR;
            HmacStart := FALSE;
            State := UINT#11;
        END_IF;
    100:
        ;
    ELSE
        Busy := FALSE;
        Error := TRUE;
        State := UINT#100;
END_CASE;
END_FUNCTION_BLOCK

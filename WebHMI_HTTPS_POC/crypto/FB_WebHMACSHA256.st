(*
 FB_WebHMACSHA256: keyed hash for TLS 1.2 PRF.
 Dependencies: FB_WebSHA256, pure ST.
 Limited to key <=64 bytes and message <=1920 bytes, enough for TLS PRF.
 A general-purpose HMAC must first SHA256 keys longer than 64 bytes;
 this restricted FB rejects them instead.
 Not validated in Sysmac, LAB ONLY, not yet TLS.
 *)
FUNCTION_BLOCK FB_WebHMACSHA256
VAR_INPUT
    Execute : BOOL;
    Key : ARRAY[0..63] OF BYTE;
    KeyLen : UINT;
    Message : ARRAY[0..1919] OF BYTE;
    MessageLen : UINT;
END_VAR
VAR_OUTPUT
    Done : BOOL;
    Busy : BOOL;
    Error : BOOL;
    Digest : ARRAY[0..31] OF BYTE;
END_VAR
VAR
    State : UINT := 0;
    Sha : FB_WebSHA256;
    HashStart : BOOL;
    HashInput : ARRAY[0..2047] OF BYTE;
    HashLength : UINT;
    Inner : ARRAY[0..31] OF BYTE;
    I : UINT;
    B : BYTE;
END_VAR
Sha(Execute:=HashStart, Length:=HashLength, Message:=HashInput);
IF (NOT Execute) AND (NOT Busy) THEN
    Done := FALSE;
    Error := FALSE;
    State := UINT#0;
END_IF;
CASE State OF
    0:
        IF Execute THEN
            Done := FALSE;
            Error := (KeyLen > UINT#64) OR (MessageLen > UINT#1920);
            IF Error THEN
                Busy := FALSE;
                State := UINT#100;
            ELSE
                Busy := TRUE;
                FOR I := UINT#0 TO UINT#63 DO
                    B := BYTE#0;
                    IF I < KeyLen THEN B := Key[I]; END_IF;
                    HashInput[I] := B XOR BYTE#16#36;
                END_FOR;
                IF MessageLen > UINT#0 THEN
                    FOR I := UINT#0 TO MessageLen - UINT#1 DO
                        HashInput[UINT#64+I] := Message[I];
                    END_FOR;
                END_IF;
                HashLength := UINT#64 + MessageLen;
                HashStart := TRUE;
                State := UINT#10;
            END_IF;
        END_IF;
    10:
        IF Sha.Done THEN
            FOR I := UINT#0 TO UINT#31 DO Inner[I] := Sha.Digest[I]; END_FOR;
            HashStart := FALSE;
            State := UINT#11;
        END_IF;
    11:
        FOR I := UINT#0 TO UINT#63 DO
            B := BYTE#0;
            IF I < KeyLen THEN B := Key[I]; END_IF;
            HashInput[I] := B XOR BYTE#16#5c;
        END_FOR;
        FOR I := UINT#0 TO UINT#31 DO HashInput[UINT#64+I] := Inner[I]; END_FOR;
        HashLength := UINT#96;
        HashStart := TRUE;
        State := UINT#12;
    12:
        IF Sha.Done THEN
            FOR I := UINT#0 TO UINT#31 DO Digest[I] := Sha.Digest[I]; END_FOR;
            HashStart := FALSE;
            Busy := FALSE;
            Done := TRUE;
            State := UINT#100;
        END_IF;
    100:
        ;
    ELSE
        Busy := FALSE;
        Error := TRUE;
        State := UINT#100;
END_CASE;
END_FUNCTION_BLOCK

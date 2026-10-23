(*
 FB_WebSHA256 - SHA-256 streaming work over PLC cyclic scans.
 CRYPTO COMPONENT ONLY: NOT TLS, NOT HTTPS. Not hardened or Sysmac validated.
 Public inputs: Execute, Length, Message[0..2047].
 Public outputs: Done, Busy, Error, Digest[0..31].
 Block compression is sliced to 8 rounds per scan.
 Maximum message length = 2048 bytes. No external dependencies.
 *)
FUNCTION_BLOCK FB_WebSHA256
VAR_INPUT
    Execute : BOOL;
    Length : UINT;
    Message : ARRAY[0..2047] OF BYTE;
END_VAR
VAR_OUTPUT
    Done : BOOL;
    Busy : BOOL;
    Error : BOOL;
    Digest : ARRAY[0..31] OF BYTE;
END_VAR
VAR
    State : UINT := 0;
    H : ARRAY[0..7] OF DWORD;
    K : ARRAY[0..63] OF DWORD;
    W : ARRAY[0..63] OF DWORD;
    BlockIndex : UINT;
    TotalBlocks : UINT;
    BitLength : UDINT;
    RoundIndex : UINT;
    I : UINT;
    J : UINT;
    StepIndex : UINT;
    ByteIndex : UINT;
    B : BYTE;
    T : DWORD;
    S0 : DWORD;
    S1 : DWORD;
    Ch : DWORD;
    Maj : DWORD;
    Temp1 : DWORD;
    Temp2 : DWORD;
    A : DWORD;
    Bb : DWORD;
    C : DWORD;
    D : DWORD;
    E : DWORD;
    F : DWORD;
    G : DWORD;
    HH : DWORD;
END_VAR
IF NOT Execute AND NOT Busy THEN
    Done := FALSE;
    Error := FALSE;
    State := UINT#0;
END_IF;
CASE State OF
    0:
        IF Execute THEN
            Done := FALSE;
            Error := Length > UINT#2048;
            IF Error THEN
                State := UINT#100;
            ELSE
                Busy := TRUE;
                BitLength := UINT_TO_UDINT(Length) * UDINT#8;
                TotalBlocks := (Length + UINT#72) / UINT#64;
                BlockIndex := UINT#0;
                H[0] := DWORD#16#6a09e667;
                H[1] := DWORD#16#bb67ae85;
                H[2] := DWORD#16#3c6ef372;
                H[3] := DWORD#16#a54ff53a;
                H[4] := DWORD#16#510e527f;
                H[5] := DWORD#16#9b05688c;
                H[6] := DWORD#16#1f83d9ab;
                H[7] := DWORD#16#5be0cd19;
                K[0] := DWORD#16#428a2f98;
                K[1] := DWORD#16#71374491;
                K[2] := DWORD#16#b5c0fbcf;
                K[3] := DWORD#16#e9b5dba5;
                K[4] := DWORD#16#3956c25b;
                K[5] := DWORD#16#59f111f1;
                K[6] := DWORD#16#923f82a4;
                K[7] := DWORD#16#ab1c5ed5;
                K[8] := DWORD#16#d807aa98;
                K[9] := DWORD#16#12835b01;
                K[10] := DWORD#16#243185be;
                K[11] := DWORD#16#550c7dc3;
                K[12] := DWORD#16#72be5d74;
                K[13] := DWORD#16#80deb1fe;
                K[14] := DWORD#16#9bdc06a7;
                K[15] := DWORD#16#c19bf174;
                K[16] := DWORD#16#e49b69c1;
                K[17] := DWORD#16#efbe4786;
                K[18] := DWORD#16#0fc19dc6;
                K[19] := DWORD#16#240ca1cc;
                K[20] := DWORD#16#2de92c6f;
                K[21] := DWORD#16#4a7484aa;
                K[22] := DWORD#16#5cb0a9dc;
                K[23] := DWORD#16#76f988da;
                K[24] := DWORD#16#983e5152;
                K[25] := DWORD#16#a831c66d;
                K[26] := DWORD#16#b00327c8;
                K[27] := DWORD#16#bf597fc7;
                K[28] := DWORD#16#c6e00bf3;
                K[29] := DWORD#16#d5a79147;
                K[30] := DWORD#16#06ca6351;
                K[31] := DWORD#16#14292967;
                K[32] := DWORD#16#27b70a85;
                K[33] := DWORD#16#2e1b2138;
                K[34] := DWORD#16#4d2c6dfc;
                K[35] := DWORD#16#53380d13;
                K[36] := DWORD#16#650a7354;
                K[37] := DWORD#16#766a0abb;
                K[38] := DWORD#16#81c2c92e;
                K[39] := DWORD#16#92722c85;
                K[40] := DWORD#16#a2bfe8a1;
                K[41] := DWORD#16#a81a664b;
                K[42] := DWORD#16#c24b8b70;
                K[43] := DWORD#16#c76c51a3;
                K[44] := DWORD#16#d192e819;
                K[45] := DWORD#16#d6990624;
                K[46] := DWORD#16#f40e3585;
                K[47] := DWORD#16#106aa070;
                K[48] := DWORD#16#19a4c116;
                K[49] := DWORD#16#1e376c08;
                K[50] := DWORD#16#2748774c;
                K[51] := DWORD#16#34b0bcb5;
                K[52] := DWORD#16#391c0cb3;
                K[53] := DWORD#16#4ed8aa4a;
                K[54] := DWORD#16#5b9cca4f;
                K[55] := DWORD#16#682e6ff3;
                K[56] := DWORD#16#748f82ee;
                K[57] := DWORD#16#78a5636f;
                K[58] := DWORD#16#84c87814;
                K[59] := DWORD#16#8cc70208;
                K[60] := DWORD#16#90befffa;
                K[61] := DWORD#16#a4506ceb;
                K[62] := DWORD#16#bef9a3f7;
                K[63] := DWORD#16#c67178f2;
                State := UINT#10;
            END_IF;
        END_IF;
    10:
        (* Construct one SHA-256 512-bit block with virtual padding and
           a 64-bit big-endian length field (high 32 bits zero). *)
        FOR I := UINT#0 TO UINT#15 DO
            T := DWORD#0;
            FOR J := UINT#0 TO UINT#3 DO
                ByteIndex := BlockIndex * UINT#64 + I * UINT#4 + J;
                B := BYTE#0;
                IF ByteIndex < Length THEN
                    B := Message[ByteIndex];
                ELSIF ByteIndex = Length THEN
                    B := BYTE#16#80;
                ELSIF ByteIndex >= TotalBlocks * UINT#64 - UINT#4 THEN
                    B := DWORD_TO_BYTE(SHR(UDINT_TO_DWORD(BitLength), (TotalBlocks * UINT#64 - UINT#1 - ByteIndex)*UINT#8));
                END_IF;
                T := SHL(T,UINT#8) OR BYTE_TO_DWORD(B);
            END_FOR;
            W[I] := T;
        END_FOR;
        FOR I := UINT#16 TO UINT#63 DO
            S0 := ROR(W[I-UINT#15],UINT#7) XOR ROR(W[I-UINT#15],UINT#18) XOR SHR(W[I-UINT#15],UINT#3);
            S1 := ROR(W[I-UINT#2],UINT#17) XOR ROR(W[I-UINT#2],UINT#19) XOR SHR(W[I-UINT#2],UINT#10);
            W[I] := UDINT_TO_DWORD(DWORD_TO_UDINT(W[I-UINT#16]) + DWORD_TO_UDINT(S0) + DWORD_TO_UDINT(W[I-UINT#7]) + DWORD_TO_UDINT(S1));
        END_FOR;
        A:=H[0]; Bb:=H[1]; C:=H[2]; D:=H[3];
        E:=H[4]; F:=H[5]; G:=H[6]; HH:=H[7];
        RoundIndex := UINT#0;
        State := UINT#20;
    20:
        FOR StepIndex := UINT#0 TO UINT#7 DO
            IF RoundIndex < UINT#64 THEN
                S1 := ROR(E,UINT#6) XOR ROR(E,UINT#11) XOR ROR(E,UINT#25);
                Ch := (E AND F) XOR ((NOT E) AND G);
                Temp1 := UDINT_TO_DWORD(DWORD_TO_UDINT(HH) + DWORD_TO_UDINT(S1) + DWORD_TO_UDINT(Ch)
                      + DWORD_TO_UDINT(K[RoundIndex]) + DWORD_TO_UDINT(W[RoundIndex]));
                S0 := ROR(A,UINT#2) XOR ROR(A,UINT#13) XOR ROR(A,UINT#22);
                Maj := (A AND Bb) XOR (A AND C) XOR (Bb AND C);
                Temp2 := UDINT_TO_DWORD(DWORD_TO_UDINT(S0) + DWORD_TO_UDINT(Maj));
                HH := G; G := F; F := E;
                E := UDINT_TO_DWORD(DWORD_TO_UDINT(D) + DWORD_TO_UDINT(Temp1));
                D := C; C := Bb; Bb := A;
                A := UDINT_TO_DWORD(DWORD_TO_UDINT(Temp1) + DWORD_TO_UDINT(Temp2));
                RoundIndex := RoundIndex + UINT#1;
            END_IF;
        END_FOR;
        IF RoundIndex = UINT#64 THEN State := UINT#30; END_IF;
    30:
        H[0] := UDINT_TO_DWORD(DWORD_TO_UDINT(H[0]) + DWORD_TO_UDINT(A));
        H[1] := UDINT_TO_DWORD(DWORD_TO_UDINT(H[1]) + DWORD_TO_UDINT(Bb));
        H[2] := UDINT_TO_DWORD(DWORD_TO_UDINT(H[2]) + DWORD_TO_UDINT(C));
        H[3] := UDINT_TO_DWORD(DWORD_TO_UDINT(H[3]) + DWORD_TO_UDINT(D));
        H[4] := UDINT_TO_DWORD(DWORD_TO_UDINT(H[4]) + DWORD_TO_UDINT(E));
        H[5] := UDINT_TO_DWORD(DWORD_TO_UDINT(H[5]) + DWORD_TO_UDINT(F));
        H[6] := UDINT_TO_DWORD(DWORD_TO_UDINT(H[6]) + DWORD_TO_UDINT(G));
        H[7] := UDINT_TO_DWORD(DWORD_TO_UDINT(H[7]) + DWORD_TO_UDINT(HH));
        BlockIndex := BlockIndex + UINT#1;
        IF BlockIndex < TotalBlocks THEN
            State := UINT#10;
        ELSE
            FOR I := UINT#0 TO UINT#7 DO
                Digest[I*UINT#4] := DWORD_TO_BYTE(SHR(H[I],UINT#24));
                Digest[I*UINT#4+UINT#1] := DWORD_TO_BYTE(SHR(H[I],UINT#16));
                Digest[I*UINT#4+UINT#2] := DWORD_TO_BYTE(SHR(H[I],UINT#8));
                Digest[I*UINT#4+UINT#3] := DWORD_TO_BYTE(H[I]);
            END_FOR;
            Busy := FALSE;
            Done := TRUE;
            State := UINT#100;
        END_IF;
    100:
        (* Done is latched until Execute becomes FALSE. *)
    ELSE
        Error := TRUE;
        Busy := FALSE;
        State := UINT#100;
END_CASE;
END_FUNCTION_BLOCK

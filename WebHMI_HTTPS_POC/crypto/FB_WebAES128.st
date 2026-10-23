(*
 FB_WebAES128 - AES-128 encryption of exactly one 16-byte block.
 For TLS AES-GCM, only the encrypt primitive is needed; GHASH and authenticated
 decryption are NOT IMPLEMENTED in this FB.
 Lab component; Sysmac compilation/timing and side-channel behavior UNVERIFIED.
 No external software on PLC. One AES round per cyclic scan.
 *)
FUNCTION_BLOCK FB_WebAES128
VAR_INPUT
    Execute : BOOL;
    Key : ARRAY[0..15] OF BYTE;
    InputBlock : ARRAY[0..15] OF BYTE;
END_VAR
VAR_OUTPUT
    Done : BOOL;
    Busy : BOOL;
    Error : BOOL;
    OutputBlock : ARRAY[0..15] OF BYTE;
END_VAR
VAR
    State : UINT := 0;
    SBox : ARRAY[0..255] OF BYTE;
    Rcon : ARRAY[0..9] OF BYTE;
    ExpandedKey : ARRAY[0..175] OF BYTE;
    DataBlock : ARRAY[0..15] OF BYTE;
    Shifted : ARRAY[0..15] OF BYTE;
    Temp : ARRAY[0..3] OF BYTE;
    Round : UINT;
    I : UINT;
    J : UINT;
    Row : UINT;
    Col : UINT;
    Base : UINT;
    A0 : BYTE;
    A1 : BYTE;
    A2 : BYTE;
    A3 : BYTE;
    MixT : BYTE;
    X : BYTE;
    M0 : BYTE;
    M1 : BYTE;
    M2 : BYTE;
    M3 : BYTE;
END_VAR
IF NOT Execute AND NOT Busy THEN
    State := UINT#0;
    Done := FALSE;
    Error := FALSE;
END_IF;
CASE State OF
    0:
        IF Execute THEN
            Done := FALSE;
            Busy := TRUE;
            SBox[0] := BYTE#16#63;
            SBox[1] := BYTE#16#7c;
            SBox[2] := BYTE#16#77;
            SBox[3] := BYTE#16#7b;
            SBox[4] := BYTE#16#f2;
            SBox[5] := BYTE#16#6b;
            SBox[6] := BYTE#16#6f;
            SBox[7] := BYTE#16#c5;
            SBox[8] := BYTE#16#30;
            SBox[9] := BYTE#16#01;
            SBox[10] := BYTE#16#67;
            SBox[11] := BYTE#16#2b;
            SBox[12] := BYTE#16#fe;
            SBox[13] := BYTE#16#d7;
            SBox[14] := BYTE#16#ab;
            SBox[15] := BYTE#16#76;
            SBox[16] := BYTE#16#ca;
            SBox[17] := BYTE#16#82;
            SBox[18] := BYTE#16#c9;
            SBox[19] := BYTE#16#7d;
            SBox[20] := BYTE#16#fa;
            SBox[21] := BYTE#16#59;
            SBox[22] := BYTE#16#47;
            SBox[23] := BYTE#16#f0;
            SBox[24] := BYTE#16#ad;
            SBox[25] := BYTE#16#d4;
            SBox[26] := BYTE#16#a2;
            SBox[27] := BYTE#16#af;
            SBox[28] := BYTE#16#9c;
            SBox[29] := BYTE#16#a4;
            SBox[30] := BYTE#16#72;
            SBox[31] := BYTE#16#c0;
            SBox[32] := BYTE#16#b7;
            SBox[33] := BYTE#16#fd;
            SBox[34] := BYTE#16#93;
            SBox[35] := BYTE#16#26;
            SBox[36] := BYTE#16#36;
            SBox[37] := BYTE#16#3f;
            SBox[38] := BYTE#16#f7;
            SBox[39] := BYTE#16#cc;
            SBox[40] := BYTE#16#34;
            SBox[41] := BYTE#16#a5;
            SBox[42] := BYTE#16#e5;
            SBox[43] := BYTE#16#f1;
            SBox[44] := BYTE#16#71;
            SBox[45] := BYTE#16#d8;
            SBox[46] := BYTE#16#31;
            SBox[47] := BYTE#16#15;
            SBox[48] := BYTE#16#04;
            SBox[49] := BYTE#16#c7;
            SBox[50] := BYTE#16#23;
            SBox[51] := BYTE#16#c3;
            SBox[52] := BYTE#16#18;
            SBox[53] := BYTE#16#96;
            SBox[54] := BYTE#16#05;
            SBox[55] := BYTE#16#9a;
            SBox[56] := BYTE#16#07;
            SBox[57] := BYTE#16#12;
            SBox[58] := BYTE#16#80;
            SBox[59] := BYTE#16#e2;
            SBox[60] := BYTE#16#eb;
            SBox[61] := BYTE#16#27;
            SBox[62] := BYTE#16#b2;
            SBox[63] := BYTE#16#75;
            SBox[64] := BYTE#16#09;
            SBox[65] := BYTE#16#83;
            SBox[66] := BYTE#16#2c;
            SBox[67] := BYTE#16#1a;
            SBox[68] := BYTE#16#1b;
            SBox[69] := BYTE#16#6e;
            SBox[70] := BYTE#16#5a;
            SBox[71] := BYTE#16#a0;
            SBox[72] := BYTE#16#52;
            SBox[73] := BYTE#16#3b;
            SBox[74] := BYTE#16#d6;
            SBox[75] := BYTE#16#b3;
            SBox[76] := BYTE#16#29;
            SBox[77] := BYTE#16#e3;
            SBox[78] := BYTE#16#2f;
            SBox[79] := BYTE#16#84;
            SBox[80] := BYTE#16#53;
            SBox[81] := BYTE#16#d1;
            SBox[82] := BYTE#16#00;
            SBox[83] := BYTE#16#ed;
            SBox[84] := BYTE#16#20;
            SBox[85] := BYTE#16#fc;
            SBox[86] := BYTE#16#b1;
            SBox[87] := BYTE#16#5b;
            SBox[88] := BYTE#16#6a;
            SBox[89] := BYTE#16#cb;
            SBox[90] := BYTE#16#be;
            SBox[91] := BYTE#16#39;
            SBox[92] := BYTE#16#4a;
            SBox[93] := BYTE#16#4c;
            SBox[94] := BYTE#16#58;
            SBox[95] := BYTE#16#cf;
            SBox[96] := BYTE#16#d0;
            SBox[97] := BYTE#16#ef;
            SBox[98] := BYTE#16#aa;
            SBox[99] := BYTE#16#fb;
            SBox[100] := BYTE#16#43;
            SBox[101] := BYTE#16#4d;
            SBox[102] := BYTE#16#33;
            SBox[103] := BYTE#16#85;
            SBox[104] := BYTE#16#45;
            SBox[105] := BYTE#16#f9;
            SBox[106] := BYTE#16#02;
            SBox[107] := BYTE#16#7f;
            SBox[108] := BYTE#16#50;
            SBox[109] := BYTE#16#3c;
            SBox[110] := BYTE#16#9f;
            SBox[111] := BYTE#16#a8;
            SBox[112] := BYTE#16#51;
            SBox[113] := BYTE#16#a3;
            SBox[114] := BYTE#16#40;
            SBox[115] := BYTE#16#8f;
            SBox[116] := BYTE#16#92;
            SBox[117] := BYTE#16#9d;
            SBox[118] := BYTE#16#38;
            SBox[119] := BYTE#16#f5;
            SBox[120] := BYTE#16#bc;
            SBox[121] := BYTE#16#b6;
            SBox[122] := BYTE#16#da;
            SBox[123] := BYTE#16#21;
            SBox[124] := BYTE#16#10;
            SBox[125] := BYTE#16#ff;
            SBox[126] := BYTE#16#f3;
            SBox[127] := BYTE#16#d2;
            SBox[128] := BYTE#16#cd;
            SBox[129] := BYTE#16#0c;
            SBox[130] := BYTE#16#13;
            SBox[131] := BYTE#16#ec;
            SBox[132] := BYTE#16#5f;
            SBox[133] := BYTE#16#97;
            SBox[134] := BYTE#16#44;
            SBox[135] := BYTE#16#17;
            SBox[136] := BYTE#16#c4;
            SBox[137] := BYTE#16#a7;
            SBox[138] := BYTE#16#7e;
            SBox[139] := BYTE#16#3d;
            SBox[140] := BYTE#16#64;
            SBox[141] := BYTE#16#5d;
            SBox[142] := BYTE#16#19;
            SBox[143] := BYTE#16#73;
            SBox[144] := BYTE#16#60;
            SBox[145] := BYTE#16#81;
            SBox[146] := BYTE#16#4f;
            SBox[147] := BYTE#16#dc;
            SBox[148] := BYTE#16#22;
            SBox[149] := BYTE#16#2a;
            SBox[150] := BYTE#16#90;
            SBox[151] := BYTE#16#88;
            SBox[152] := BYTE#16#46;
            SBox[153] := BYTE#16#ee;
            SBox[154] := BYTE#16#b8;
            SBox[155] := BYTE#16#14;
            SBox[156] := BYTE#16#de;
            SBox[157] := BYTE#16#5e;
            SBox[158] := BYTE#16#0b;
            SBox[159] := BYTE#16#db;
            SBox[160] := BYTE#16#e0;
            SBox[161] := BYTE#16#32;
            SBox[162] := BYTE#16#3a;
            SBox[163] := BYTE#16#0a;
            SBox[164] := BYTE#16#49;
            SBox[165] := BYTE#16#06;
            SBox[166] := BYTE#16#24;
            SBox[167] := BYTE#16#5c;
            SBox[168] := BYTE#16#c2;
            SBox[169] := BYTE#16#d3;
            SBox[170] := BYTE#16#ac;
            SBox[171] := BYTE#16#62;
            SBox[172] := BYTE#16#91;
            SBox[173] := BYTE#16#95;
            SBox[174] := BYTE#16#e4;
            SBox[175] := BYTE#16#79;
            SBox[176] := BYTE#16#e7;
            SBox[177] := BYTE#16#c8;
            SBox[178] := BYTE#16#37;
            SBox[179] := BYTE#16#6d;
            SBox[180] := BYTE#16#8d;
            SBox[181] := BYTE#16#d5;
            SBox[182] := BYTE#16#4e;
            SBox[183] := BYTE#16#a9;
            SBox[184] := BYTE#16#6c;
            SBox[185] := BYTE#16#56;
            SBox[186] := BYTE#16#f4;
            SBox[187] := BYTE#16#ea;
            SBox[188] := BYTE#16#65;
            SBox[189] := BYTE#16#7a;
            SBox[190] := BYTE#16#ae;
            SBox[191] := BYTE#16#08;
            SBox[192] := BYTE#16#ba;
            SBox[193] := BYTE#16#78;
            SBox[194] := BYTE#16#25;
            SBox[195] := BYTE#16#2e;
            SBox[196] := BYTE#16#1c;
            SBox[197] := BYTE#16#a6;
            SBox[198] := BYTE#16#b4;
            SBox[199] := BYTE#16#c6;
            SBox[200] := BYTE#16#e8;
            SBox[201] := BYTE#16#dd;
            SBox[202] := BYTE#16#74;
            SBox[203] := BYTE#16#1f;
            SBox[204] := BYTE#16#4b;
            SBox[205] := BYTE#16#bd;
            SBox[206] := BYTE#16#8b;
            SBox[207] := BYTE#16#8a;
            SBox[208] := BYTE#16#70;
            SBox[209] := BYTE#16#3e;
            SBox[210] := BYTE#16#b5;
            SBox[211] := BYTE#16#66;
            SBox[212] := BYTE#16#48;
            SBox[213] := BYTE#16#03;
            SBox[214] := BYTE#16#f6;
            SBox[215] := BYTE#16#0e;
            SBox[216] := BYTE#16#61;
            SBox[217] := BYTE#16#35;
            SBox[218] := BYTE#16#57;
            SBox[219] := BYTE#16#b9;
            SBox[220] := BYTE#16#86;
            SBox[221] := BYTE#16#c1;
            SBox[222] := BYTE#16#1d;
            SBox[223] := BYTE#16#9e;
            SBox[224] := BYTE#16#e1;
            SBox[225] := BYTE#16#f8;
            SBox[226] := BYTE#16#98;
            SBox[227] := BYTE#16#11;
            SBox[228] := BYTE#16#69;
            SBox[229] := BYTE#16#d9;
            SBox[230] := BYTE#16#8e;
            SBox[231] := BYTE#16#94;
            SBox[232] := BYTE#16#9b;
            SBox[233] := BYTE#16#1e;
            SBox[234] := BYTE#16#87;
            SBox[235] := BYTE#16#e9;
            SBox[236] := BYTE#16#ce;
            SBox[237] := BYTE#16#55;
            SBox[238] := BYTE#16#28;
            SBox[239] := BYTE#16#df;
            SBox[240] := BYTE#16#8c;
            SBox[241] := BYTE#16#a1;
            SBox[242] := BYTE#16#89;
            SBox[243] := BYTE#16#0d;
            SBox[244] := BYTE#16#bf;
            SBox[245] := BYTE#16#e6;
            SBox[246] := BYTE#16#42;
            SBox[247] := BYTE#16#68;
            SBox[248] := BYTE#16#41;
            SBox[249] := BYTE#16#99;
            SBox[250] := BYTE#16#2d;
            SBox[251] := BYTE#16#0f;
            SBox[252] := BYTE#16#b0;
            SBox[253] := BYTE#16#54;
            SBox[254] := BYTE#16#bb;
            SBox[255] := BYTE#16#16;
            Rcon[0]:=BYTE#16#01; Rcon[1]:=BYTE#16#02;
            Rcon[2]:=BYTE#16#04; Rcon[3]:=BYTE#16#08;
            Rcon[4]:=BYTE#16#10; Rcon[5]:=BYTE#16#20;
            Rcon[6]:=BYTE#16#40; Rcon[7]:=BYTE#16#80;
            Rcon[8]:=BYTE#16#1b; Rcon[9]:=BYTE#16#36;
            FOR I := UINT#0 TO UINT#15 DO
                DataBlock[I] := InputBlock[I] XOR Key[I];
                ExpandedKey[I] := Key[I];
            END_FOR;
            State := UINT#10;
        END_IF;
    10:
        (* AES-128 expands 16 input key bytes to 176 round-key bytes. *)
        FOR I := UINT#16 TO UINT#172 BY UINT#4 DO
            FOR J := UINT#0 TO UINT#3 DO
                Temp[J] := ExpandedKey[I-UINT#4+J];
            END_FOR;
            IF (I MOD UINT#16) = UINT#0 THEN
                X := Temp[0];
                Temp[0] := SBox[BYTE_TO_UINT(Temp[1])] XOR Rcon[I/UINT#16-UINT#1];
                Temp[1] := SBox[BYTE_TO_UINT(Temp[2])];
                Temp[2] := SBox[BYTE_TO_UINT(Temp[3])];
                Temp[3] := SBox[BYTE_TO_UINT(X)];
            END_IF;
            FOR J := UINT#0 TO UINT#3 DO
                ExpandedKey[I+J] := ExpandedKey[I-UINT#16+J] XOR Temp[J];
            END_FOR;
        END_FOR;
        Round := UINT#1;
        State := UINT#20;
    20:
        (* SubBytes + ShiftRows. Input and output are column-major AES state. *)
        FOR Col := UINT#0 TO UINT#3 DO
            FOR Row := UINT#0 TO UINT#3 DO
                Shifted[Col*UINT#4+Row] := SBox[BYTE_TO_UINT(
                  DataBlock[(((Col+Row) MOD UINT#4)*UINT#4)+Row])];
            END_FOR;
        END_FOR;
        FOR I := UINT#0 TO UINT#15 DO DataBlock[I] := Shifted[I]; END_FOR;

        IF Round < UINT#10 THEN
            FOR Col := UINT#0 TO UINT#3 DO
                Base := Col*UINT#4;
                A0:=DataBlock[Base]; A1:=DataBlock[Base+UINT#1];
                A2:=DataBlock[Base+UINT#2]; A3:=DataBlock[Base+UINT#3];
                MixT := A0 XOR A1 XOR A2 XOR A3;

                X := A0 XOR A1;
                M0 := SHL(X,UINT#1);
                IF (X AND BYTE#16#80) <> BYTE#0 THEN M0 := M0 XOR BYTE#16#1b; END_IF;
                X := A1 XOR A2;
                M1 := SHL(X,UINT#1);
                IF (X AND BYTE#16#80) <> BYTE#0 THEN M1 := M1 XOR BYTE#16#1b; END_IF;
                X := A2 XOR A3;
                M2 := SHL(X,UINT#1);
                IF (X AND BYTE#16#80) <> BYTE#0 THEN M2 := M2 XOR BYTE#16#1b; END_IF;
                X := A3 XOR A0;
                M3 := SHL(X,UINT#1);
                IF (X AND BYTE#16#80) <> BYTE#0 THEN M3 := M3 XOR BYTE#16#1b; END_IF;

                DataBlock[Base] := A0 XOR MixT XOR M0;
                DataBlock[Base+UINT#1] := A1 XOR MixT XOR M1;
                DataBlock[Base+UINT#2] := A2 XOR MixT XOR M2;
                DataBlock[Base+UINT#3] := A3 XOR MixT XOR M3;
            END_FOR;
        END_IF;

        FOR I := UINT#0 TO UINT#15 DO
            DataBlock[I] := DataBlock[I] XOR ExpandedKey[Round*UINT#16+I];
        END_FOR;
        IF Round = UINT#10 THEN
            FOR I := UINT#0 TO UINT#15 DO OutputBlock[I] := DataBlock[I]; END_FOR;
            Busy := FALSE;
            Done := TRUE;
            State := UINT#100;
        ELSE
            Round := Round + UINT#1;
        END_IF;
    100:
        (* Done remains latched until Execute is released. *)
    ELSE
        Busy := FALSE;
        Error := TRUE;
        State := UINT#100;
END_CASE;
END_FUNCTION_BLOCK

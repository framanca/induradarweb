(* WebHMI HTTPS - Cryptographic self-test in an isolated NX102-9000.
  REQUIRES FB_WebSHA256, FB_WebAES128, FB_WebAESGCM already created.
  NO SOCKETS OR HTTPS, NO EXTERNAL CONTROL VARIABLES, NO PRODUCTION USE.
  Expected data: SHA-256("abc"), AES-128 FIPS 197, AES-GCM NIST 800-38D.
  Import local TSV alongside this body into a new Program POU.
  Observe WebTest_Done, WebTest_Passed, WebTest_CyclesSHA/AES/GCM in Sysmac.
*)
WebTest_SHA(Execute:=WebTest_SHAStart, Length:=UINT#3, Message:=WebTest_SHAInput);
WebTest_AES(Execute:=WebTest_AESStart, Key:=WebTest_AESKey, InputBlock:=WebTest_AESInput);
WebTest_GCM(Execute:=WebTest_GCMStart, Encrypt:=TRUE,
            Key:=WebTest_GCMKey, Nonce:=WebTest_GCMNonce,
            AAD:=WebTest_GCMAAD, AadLen:=UINT#0,
            Data:=WebTest_GCMData, DataLen:=UINT#16,
            TagIn:=WebTest_GCMTagIn);
CASE WebTest_State OF
0:
    WebTest_Done := FALSE;
    WebTest_Passed := TRUE;
    WebTest_SHAStart := FALSE;
    WebTest_AESStart := FALSE;
    WebTest_GCMStart := FALSE;
    WebTest_CyclesSHA := UDINT#0;
    WebTest_CyclesAES := UDINT#0;
    WebTest_CyclesGCM := UDINT#0;
    WebTest_SHAInput[0] := BYTE#16#61;
    WebTest_SHAInput[1] := BYTE#16#62;
    WebTest_SHAInput[2] := BYTE#16#63;
    FOR WebTest_I := UINT#0 TO UINT#15 DO
        WebTest_AESKey[WebTest_I] := UINT_TO_BYTE(WebTest_I);
        WebTest_GCMKey[WebTest_I] := BYTE#0;
        WebTest_GCMData[WebTest_I] := BYTE#0;
        WebTest_GCMTagIn[WebTest_I] := BYTE#0;
    END_FOR;
    FOR WebTest_I := UINT#0 TO UINT#11 DO
        WebTest_GCMNonce[WebTest_I] := BYTE#0;
    END_FOR;
    WebTest_AESInput[0] := BYTE#16#00;
    WebTest_AESInput[1] := BYTE#16#11;
    WebTest_AESInput[2] := BYTE#16#22;
    WebTest_AESInput[3] := BYTE#16#33;
    WebTest_AESInput[4] := BYTE#16#44;
    WebTest_AESInput[5] := BYTE#16#55;
    WebTest_AESInput[6] := BYTE#16#66;
    WebTest_AESInput[7] := BYTE#16#77;
    WebTest_AESInput[8] := BYTE#16#88;
    WebTest_AESInput[9] := BYTE#16#99;
    WebTest_AESInput[10] := BYTE#16#aa;
    WebTest_AESInput[11] := BYTE#16#bb;
    WebTest_AESInput[12] := BYTE#16#cc;
    WebTest_AESInput[13] := BYTE#16#dd;
    WebTest_AESInput[14] := BYTE#16#ee;
    WebTest_AESInput[15] := BYTE#16#ff;
    WebTest_State := UINT#10;
10:
    WebTest_SHAStart := TRUE;
    WebTest_State := UINT#20;
20:
    WebTest_CyclesSHA := WebTest_CyclesSHA + UDINT#1;
    IF WebTest_SHA.Done OR WebTest_SHA.Error THEN
        IF WebTest_SHA.Error THEN
            WebTest_Passed := FALSE;
        ELSE
            IF WebTest_SHA.Digest[0] <> BYTE#16#ba THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[1] <> BYTE#16#78 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[2] <> BYTE#16#16 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[3] <> BYTE#16#bf THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[4] <> BYTE#16#8f THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[5] <> BYTE#16#01 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[6] <> BYTE#16#cf THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[7] <> BYTE#16#ea THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[8] <> BYTE#16#41 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[9] <> BYTE#16#41 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[10] <> BYTE#16#40 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[11] <> BYTE#16#de THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[12] <> BYTE#16#5d THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[13] <> BYTE#16#ae THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[14] <> BYTE#16#22 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[15] <> BYTE#16#23 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[16] <> BYTE#16#b0 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[17] <> BYTE#16#03 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[18] <> BYTE#16#61 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[19] <> BYTE#16#a3 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[20] <> BYTE#16#96 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[21] <> BYTE#16#17 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[22] <> BYTE#16#7a THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[23] <> BYTE#16#9c THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[24] <> BYTE#16#b4 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[25] <> BYTE#16#10 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[26] <> BYTE#16#ff THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[27] <> BYTE#16#61 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[28] <> BYTE#16#f2 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[29] <> BYTE#16#00 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[30] <> BYTE#16#15 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_SHA.Digest[31] <> BYTE#16#ad THEN WebTest_Passed := FALSE; END_IF;
        END_IF;
        WebTest_SHAStart := FALSE;
        WebTest_State := UINT#30;
    END_IF;
30:
    WebTest_AESStart := TRUE;
    WebTest_State := UINT#40;
40:
    WebTest_CyclesAES := WebTest_CyclesAES + UDINT#1;
    IF WebTest_AES.Done OR WebTest_AES.Error THEN
        IF WebTest_AES.Error THEN
            WebTest_Passed := FALSE;
        ELSE
            IF WebTest_AES.OutputBlock[0] <> BYTE#16#69 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[1] <> BYTE#16#c4 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[2] <> BYTE#16#e0 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[3] <> BYTE#16#d8 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[4] <> BYTE#16#6a THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[5] <> BYTE#16#7b THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[6] <> BYTE#16#04 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[7] <> BYTE#16#30 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[8] <> BYTE#16#d8 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[9] <> BYTE#16#cd THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[10] <> BYTE#16#b7 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[11] <> BYTE#16#80 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[12] <> BYTE#16#70 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[13] <> BYTE#16#b4 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[14] <> BYTE#16#c5 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_AES.OutputBlock[15] <> BYTE#16#5a THEN WebTest_Passed := FALSE; END_IF;
        END_IF;
        WebTest_AESStart := FALSE;
        WebTest_State := UINT#50;
    END_IF;
50:
    WebTest_GCMStart := TRUE;
    WebTest_State := UINT#60;
60:
    WebTest_CyclesGCM := WebTest_CyclesGCM + UDINT#1;
    IF WebTest_GCM.Done OR WebTest_GCM.Error THEN
        IF WebTest_GCM.Error OR NOT WebTest_GCM.Valid THEN
            WebTest_Passed := FALSE;
        ELSE
            IF WebTest_GCM.Result[0] <> BYTE#16#03 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[1] <> BYTE#16#88 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[2] <> BYTE#16#da THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[3] <> BYTE#16#ce THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[4] <> BYTE#16#60 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[5] <> BYTE#16#b6 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[6] <> BYTE#16#a3 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[7] <> BYTE#16#92 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[8] <> BYTE#16#f3 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[9] <> BYTE#16#28 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[10] <> BYTE#16#c2 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[11] <> BYTE#16#b9 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[12] <> BYTE#16#71 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[13] <> BYTE#16#b2 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[14] <> BYTE#16#fe THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Result[15] <> BYTE#16#78 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[0] <> BYTE#16#ab THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[1] <> BYTE#16#6e THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[2] <> BYTE#16#47 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[3] <> BYTE#16#d4 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[4] <> BYTE#16#2c THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[5] <> BYTE#16#ec THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[6] <> BYTE#16#13 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[7] <> BYTE#16#bd THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[8] <> BYTE#16#f5 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[9] <> BYTE#16#3a THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[10] <> BYTE#16#67 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[11] <> BYTE#16#b2 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[12] <> BYTE#16#12 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[13] <> BYTE#16#57 THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[14] <> BYTE#16#bd THEN WebTest_Passed := FALSE; END_IF;
            IF WebTest_GCM.Tag[15] <> BYTE#16#df THEN WebTest_Passed := FALSE; END_IF;
        END_IF;
        WebTest_GCMStart := FALSE;
        WebTest_Done := TRUE;
        WebTest_State := UINT#100;
    END_IF;
100:
    IF WebTest_Reset THEN WebTest_State := UINT#0; END_IF;
ELSE
    WebTest_Passed := FALSE;
    WebTest_Done := TRUE;
    WebTest_State := UINT#100;
END_CASE;

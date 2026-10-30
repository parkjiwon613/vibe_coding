import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, Download, Eye, FileBarChart, FileCheck, FileText, Filter, Globe2, Landmark, LayoutDashboard, LifeBuoy, MoreHorizontal, Printer, RefreshCw, Search, ShieldCheck, UploadCloud, Users, Wallet, X, Zap } from "lucide-react";
type Page="dashboard"|"input"|"method"|"evidence"|"approvals"|"ledger"|"detail";
type Tone="teal"|"blue"|"amber"|"red"|"green"|"slate";
type Tx={id:string;name:string;amount:string;rail:string;state:string;tone:Tone;date:string;country:string};
type FxQuote={rate:number;previousClose:number|null;change:number|null;changePercent:number|null;asOf:string|null};
const txs:Tx[]=[
{id:"RM-20261028-0042",name:"Pacific Trade Logistics Ltd.",amount:"32,500.00",rail:"USDC (Polygon)",state:"결재대기",tone:"amber",date:"10-28 14:10",country:"SG"},
{id:"RM-20261028-0039",name:"Apex Semi-Fab Corp.",amount:"24,000.00",rail:"USDC (Base)",state:"정산 중",tone:"teal",date:"10-28 13:45",country:"US"},
{id:"RM-20261028-0036",name:"Shenzhen Micro Instruments",amount:"15,800.00",rail:"SWIFT GPI",state:"증빙 반려",tone:"red",date:"10-28 11:22",country:"HK"},
{id:"RM-20261028-0035",name:"EuroTech Materials GMBH",amount:"8,900.00",rail:"USDC (Ethereum)",state:"승인완료",tone:"green",date:"10-28 10:18",country:"DE"},
{id:"RM-20261028-0031",name:"Tokyo Components Inc.",amount:"3,000.00",rail:"USDC (Polygon)",state:"확인 중",tone:"blue",date:"10-28 09:42",country:"JP"}];
function Btn({children,onClick,kind=""}:{children:ReactNode;onClick?:()=>void;kind?:string}){return <button type="button" className={"btn "+kind} onClick={onClick}>{children}</button>}
function Tag({children,tone="slate"}:{children:ReactNode;tone?:Tone}){return <span className={"tag "+tone}><i/>{children}</span>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Heading({title,crumb}:{title:string;crumb:string}){return <div className="heading"><div className="crumb">외환관리 <ChevronRight size={12}/>{crumb}</div><h1>{title}</h1></div>}
function Steps({active}:{active:number}){return <div className="steps">{["정보 입력","조건 확인","증빙 첨부"].map((s,i)=><span key={s} className={active===i+1?"current":active>i+1?"done":""}><b>{active>i+1?<Check size={12}/>:i+1}</b>{s}</span>)}</div>}
function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <div className="metric">
      <div>
        {label}
        <span>
          <Icon size={16} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}export default function App(){
 const [page,setPage]=useState<Page>("dashboard"),[toast,setToast]=useState(""),[tab,setTab]=useState("전체"),[status,setStatus]=useState("전체 상태"),[query,setQuery]=useState(""),[selected,setSelected]=useState<Tx>(txs[0]),[method,setMethod]=useState<"stable"|"swift">("stable"),[beneficiary,setBeneficiary]=useState("Apex Global Tech Ltd."),[amount,setAmount]=useState("28,000.00"),[comment,setComment]=useState("북미 거래처 분기 서버 부품 수입 건에 대한 정기 결제입니다. 승인 부탁드립니다."),[docs,setDocs]=useState(["상업송장 (Commercial Invoice)","선하증권 (B/L)"]),[incident,setIncident]=useState(true),[swift,setSwift]=useState(false),[rejectionOpen,setRejectionOpen]=useState(false),[rejectionReason,setRejectionReason]=useState(""),[supabaseInput,setSupabaseInput]=useState(""),[inputSaving,setInputSaving]=useState(false),[fxQuote,setFxQuote]=useState<FxQuote|null>(null),[fxLoading,setFxLoading]=useState(true),[fxError,setFxError]=useState(""),[sessionRemaining,setSessionRemaining]=useState(30*60);
 const notify=(s:string)=>{setToast(s);window.setTimeout(()=>setToast(""),2500)},go=(p:Page)=>{setPage(p);window.scrollTo({top:0,behavior:"smooth"})};
 const handleSaveInput=async()=>{
   const content=supabaseInput.trim();
   if(!content){notify("Supabase에 저장할 내용을 입력해 주세요.");return;}
   if(inputSaving)return;
   if(!supabase){notify("Supabase 환경변수를 먼저 설정해 주세요.");return;}
   setInputSaving(true);
   try{
     const {error}=await supabase.from("input_db").insert({input:content});
     if(error){
       console.error("Supabase input save failed:",error);
       notify("저장에 실패했습니다. Supabase 테이블과 RLS 정책을 확인해 주세요.");
       return;
     }
     setSupabaseInput("");
     notify("입력한 내용이 Supabase에 저장되었습니다.");
   }catch(error){
     console.error("Supabase connection error:",error);
     notify("Supabase 연결 중 오류가 발생했습니다.");
   }finally{
     setInputSaving(false);
   }
 };

 const SESSION_DURATION_SECONDS=30*60;
 useEffect(()=>{
   const timer=window.setInterval(()=>setSessionRemaining(seconds=>Math.max(0,seconds-1)),1000);
   return ()=>window.clearInterval(timer);
 },[]);
 useEffect(()=>{
   let active=true;
   const loadQuote=async()=>{
     try{
       const response=await fetch("/api/exchange-rate",{headers:{Accept:"application/json"},cache:"no-store"});
       if(!response.ok) throw new Error("Yahoo Finance request failed");
       const payload=await response.json();
       const result=payload?.chart?.result?.[0];
       const metadata=result?.meta;
       const closes=result?.indicators?.quote?.[0]?.close;
       const lastClose=Array.isArray(closes)?closes.slice().reverse().find((value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value)):undefined;
       const rateCandidate=typeof metadata?.regularMarketPrice==="number"?metadata.regularMarketPrice:lastClose;
       if(typeof rateCandidate!=="number"||!Number.isFinite(rateCandidate)) throw new Error("Yahoo Finance quote is missing");
       const previousCandidate=metadata?.chartPreviousClose??metadata?.previousClose;
       const previousClose=typeof previousCandidate==="number"&&Number.isFinite(previousCandidate)?previousCandidate:null;
       const timestamps=result?.timestamp;
       const timestampCandidate=typeof metadata?.regularMarketTime==="number"?metadata.regularMarketTime:Array.isArray(timestamps)?timestamps[timestamps.length-1]:null;
       const asOf=typeof timestampCandidate==="number"?new Date(timestampCandidate*1000).toISOString():null;
       if(active){
         setFxQuote({rate:rateCandidate,previousClose,change:previousClose===null?null:rateCandidate-previousClose,changePercent:previousClose===null||previousClose===0?null:((rateCandidate-previousClose)/previousClose)*100,asOf});
         setFxError("");
       }
     }catch{
       if(active) setFxError("Yahoo Finance 시세를 불러오지 못했습니다.");
     }finally{
       if(active) setFxLoading(false);
     }
   };
   void loadQuote();
   const timer=window.setInterval(()=>void loadQuote(),60_000);
   return ()=>{active=false;window.clearInterval(timer)};
 },[]);
 const referenceRate=fxQuote?.rate??1382.5;
 const stableRate=referenceRate;
 const swiftRate=referenceRate+5.7;
 const amountValue=Math.max(0,Number(amount.replace(/,/g,""))||0);
 const usdAmountLabel=amountValue.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
 const formatRate=(value:number)=>value.toLocaleString("ko-KR",{minimumFractionDigits:2,maximumFractionDigits:2});
 const formatKrw=(value:number)=>`${Math.round(value).toLocaleString("ko-KR")} KRW`;
 const selectedRate=method==="stable"?stableRate:swiftRate;
 const selectedFee=method==="stable"?38000:72500;
 const selectedTotal=amountValue*selectedRate+selectedFee;
 const rateChangeLabel=fxQuote?.change==null?(fxLoading?"Yahoo Finance 시세 조회 중":"시세 연결 실패 · 임시 기준값 표시"):`전일 대비 ${fxQuote.change>=0?"+":""}${formatRate(fxQuote.change)} (${fxQuote.changePercent==null?"—":`${fxQuote.changePercent>=0?"+":""}${fxQuote.changePercent.toFixed(2)}%`})`;
 const rateChangeClass=fxQuote?.change==null?"rate-neutral":fxQuote.change>=0?"up":"down";
 const rateTimeLabel=fxQuote?.asOf?new Date(fxQuote.asOf).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}):"시세 기준 시각 확인 중";
 const sessionLabel=`${String(Math.floor(sessionRemaining/60)).padStart(2,"0")}:${String(sessionRemaining%60).padStart(2,"0")}`;
const rows = useMemo(
  () =>
    txs.filter((x) => {
      const matchesDashboardTab =
        page !== "dashboard" ||
        tab === "전체" ||
        (tab === "USDC 블록체인"
          ? x.rail.startsWith("USDC")
          : x.rail === "SWIFT GPI");

      const matchesLedgerFilters =
        page !== "ledger" ||
        ((status === "전체 상태" || status === x.state) &&
          (!query ||
            [x.id, x.name, x.rail].some((y) =>
              y.toLowerCase().includes(query.toLowerCase())
            )));

      return matchesDashboardTab && matchesLedgerFilters;
    }),
  [page, tab, status, query]
); const open=(id:string)=>{setSelected(txs.find(x=>x.id===id)||txs[0]);go("detail")};
 const exportCsv=()=>{const csv="\uFEFF"+[["거래번호","거래일시","수취기업","금액","정산 레일","상태"],...rows.map(x=>[x.id,x.date,x.name,x.amount,x.rail,x.state])].map(r=>r.join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="remittance-ledger.csv";a.click();URL.revokeObjectURL(url);notify("거래내역 CSV를 내보냈습니다.")};
 const nav=[{id:"dashboard" as Page,label:"홈 (대시보드 / 업무 현황)",icon:LayoutDashboard},{id:"input" as Page,label:"해외송금 신청",icon:ArrowLeftRight},{id:"approvals" as Page,label:"승인관리",icon:FileCheck},{id:"ledger" as Page,label:"거래내역 (조회/상태)",icon:FileBarChart}];
 const table=(list:Tx[])=> <div className="table-scroll"><table><thead><tr><th>No</th><th>거래식별번호</th><th>수취기업</th><th>송금 금액</th><th>정산 레일</th><th>처리 상태</th><th>작업</th></tr></thead><tbody>{list.map((x,i)=><tr key={x.id}><td>{String(i+1).padStart(2,"0")}</td><td><button className="link" onClick={()=>open(x.id)}>{x.id}</button></td><td>{x.name}</td><td className="money">{x.amount} <small>USD</small></td><td><span className="rail">{x.rail}</span></td><td><Tag tone={x.tone}>{x.state}</Tag></td><td><button className="row-action" onClick={()=>open(x.id)}>상세보기</button></td></tr>)}</tbody></table>{!list.length&&<div className="empty">검색 조건에 맞는 거래내역이 없습니다.</div>}</div>;
 const isNavActive=(id:Page)=>page===id||(id==="input"&&["method","evidence"].includes(page))||(id==="ledger"&&page==="detail");
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><span><Globe2 size={19}/></span><div><b>BUSINESS SUITE</b><small>해외송금 · 블록체인</small></div></div><div className="nav-caption">WORKSPACE</div><nav>{nav.map(n=>{const I=n.icon;return <button key={n.id} className={isNavActive(n.id)?"active":""} onClick={()=>go(n.id)}><I size={17}/><span>{n.label}</span>{n.id==="approvals"&&<em>3</em>}</button>})}<label>업무 관리</label><button onClick={()=>notify("수취인 관리 화면은 다음 개발 단계에서 연결할 수 있습니다.")}><Users size={17}/><span>수취인 관리</span></button><button onClick={()=>notify("한도·권한 설정 화면은 다음 개발 단계에서 연결할 수 있습니다.")}><ShieldCheck size={17}/><span>한도·권한 설정</span></button><button onClick={()=>notify("정산 리포트 화면은 다음 개발 단계에서 연결할 수 있습니다.")}><FileBarChart size={17}/><span>정산 리포트</span></button><label>지원</label><button onClick={()=>notify("외환 고객센터 연결을 준비 중입니다.")}><LifeBuoy size={17}/><span>외환 / 고객센터</span></button></nav><div className="sidebar-bottom"><div className="secure">● 보안모듈 정상 작동중<small>금융보안원 전자금융 암호화 적용</small></div><div className="user"><b>홍길동</b><small>재무관리부 · 관리자</small></div></div></aside>
 <div className="main-shell"><header><div className="top-left"><b><Landmark size={16}/> 하나은행</b><i/><strong>(주)한빛무역</strong><small>기업뱅킹 | 외환엔진</small></div><div className="top-right"><span><Clock3 size={14}/> 세션 유지시간 <b className={sessionRemaining<=300?"session-warning":""}>{sessionLabel}</b> <button onClick={()=>{setSessionRemaining(SESSION_DURATION_SECONDS);notify("세션 유지시간이 30분 연장되었습니다.")}}>연장</button></span><button onClick={()=>notify("새 알림이 없습니다.")}><Bell size={17}/></button><button onClick={()=>notify("인증센터로 이동합니다.")}><ShieldCheck size={17}/></button><button className="logout" onClick={()=>notify("로그아웃은 데모 화면에서 처리되지 않습니다.")}>로그아웃</button></div></header>
 <main className="content">
 {page==="dashboard"&&<><div className="page-head"><Heading title="해외송금 통합 대시보드" crumb="해외송금 업무 현황"/><Btn onClick={()=>window.print()}>↓ 일일 마감 보고서</Btn></div><div className="metrics"><Metric label="결재 승인 대기" value="3" note="전일 대비 1건 증가" icon={Clock3}/><Metric label="송금 처리 중" value="4" note="평균 처리시간 45분" icon={Activity}/><Metric label="증빙 확인 필요" value="1" note="확인 후 재상신 필요" icon={AlertTriangle}/><Metric label="당월 누적 송금" value="$432,000" note="월간 한도 대비 21.6%" icon={Wallet}/></div><section className="panel form-panel" style={{marginBottom:16}}>
  <div className="panel-head" style={{padding:0,marginBottom:12}}>
    <div>
      <b>Supabase 데이터 입력</b>
      <small>입력한 내용은 저장 버튼을 누르면 input_db 테이블에 기록됩니다.</small>
    </div>
    <Tag tone="blue">데이터 저장</Tag>
  </div>
  <Field label="저장할 내용">
    <input
      type="text"
      value={supabaseInput}
      onChange={e=>setSupabaseInput(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter"&&!inputSaving)void handleSaveInput()}}
      placeholder="Supabase에 저장할 내용을 입력하세요."
    />
  </Field>
  <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
    <button
      type="button"
      className="btn primary"
      onClick={()=>void handleSaveInput()}
      disabled={inputSaving||!supabaseInput.trim()}
    >
      {inputSaving?"저장 중...":"Supabase에 저장"}
    </button>
  </div>
</section><div className="dashboard-grid"><section className="panel"><div className="panel-head soft"><b>● 진행 중 <em>5</em></b><Btn kind="ghost" onClick={()=>go("ledger")}>전체 거래 보기 <ArrowRight size={13}/></Btn></div><div className="tabs">{["전체","USDC 블록체인","SWIFT 전통망"].map(x=><button className={tab===x?"selected":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</div>{table(rows)}<div className="table-foot">최근 업데이트: 2026-10-28 14:34 KST <button onClick={()=>go("ledger")}>거래 원장 바로가기 →</button></div></section><div className="side-stack"><section className="panel"><div className="panel-head"><b>기업 송금한도 현황</b><MoreHorizontal size={16}/></div>{[["1회 송금 한도","10,000 / 50,000 USD","잔여: 40,000 USD",20],["1일 누적 한도","55,200 / 200,000 USD","잔여: 144,800 USD",27.6],["당월 누적 한도 (10월)","432,000 / 2,000,000 USD","잔여: 1,568,000 USD",21.6]].map(x=><div className="limit" key={x[0]}><div><b>{x[0]}</b><span>{Number(x[3]).toFixed(1)}%</span></div><strong>{x[1]}</strong><div className="progress"><i style={{width:x[3]+"%"}}/></div><small>{x[2]}</small></div>)}</section><section className="panel"><div className="panel-head"><b>공지 / 가이드</b><button className="link" onClick={()=>notify("공지 전체 목록은 준비 중입니다.")}>전체보기</button></div>{[["법령준수","외국환거래법 제18조 증빙제출 안내"],["운영점검","미국 연준 Fedwire 정기 점검 공지"],["혜택","스테이블코인 정산 수수료 우대 혜택"]].map(x=><div className="notice" key={x[0]}><i/><span><b>{x[0]}</b><small>{x[1]}</small></span></div>)}</section></div></div><div className="callout"><ShieldCheck size={18}/><div><b>안전한 기업 해외송금</b><small>금융보안원 전자금융 암호화 적용 · 거래별 이력 및 증빙 자동 보관</small></div><button onClick={()=>go("input")}>새 송금 신청 →</button></div></>}
 {page==="input"&&<><div className="workflow-head"><Heading title="해외송금 정보 입력" crumb="해외송금 신청"/><Steps active={1}/></div><div className="workflow-grid"><div className="forms"><section className="panel form-panel"><h2>1. 출금 정보</h2><p>송금에 사용할 기업 계좌를 확인합니다.</p><Field label="출금 계좌"><select><option>하나은행 보통예금 [102-910234-88102]</option><option>하나은행 외화예금 [102-910234-99201]</option></select></Field><div className="account"><div><small>출금 가능 잔액</small><b>1,428,500,000 KRW</b></div><div><small>계좌 예금주</small><b>(주)한빛무역</b></div><Btn onClick={()=>notify("계좌 잔액을 새로 조회했습니다.")}>계좌조회</Btn></div><Field label="송금 목적"><select><option>무역대금 결제 (수입물품 대금)</option><option>용역 대금 지급</option></select></Field><Field label="거래 메모"><input defaultValue="반도체 패키징 검사장비 부품 수입 대금 결제건"/></Field></section><section className="panel form-panel"><h2>2. 수취인 정보</h2><p>등록된 수취인 또는 신규 수취 정보를 입력합니다.</p><Field label="수취인 상호"><input value={beneficiary} onChange={e=>setBeneficiary(e.target.value)}/></Field><div className="field-row"><Field label="수취 국가"><select><option>미국 (UNITED STATES)</option><option>싱가포르 (SINGAPORE)</option></select></Field><Field label="수취 은행"><input defaultValue="JPMorgan Chase Bank, N.A."/></Field></div><div className="field-row"><Field label="은행 식별코드 (SWIFT)"><input defaultValue="CHASUS33XXX"/></Field><Field label="수취 계좌번호"><input defaultValue="US98 CHAS 0210 0002 1234 5678"/></Field></div><Field label="수취인 주소"><input defaultValue="120 Broadway, Suite 2400, New York, NY 10271, United States"/></Field></section><section className="panel form-panel"><h2>3. 송금 금액</h2><p>송금 통화와 지급 금액을 설정합니다.</p><div className="amount"><b>USD <ChevronDown size={13}/></b><input value={amount} onChange={e=>setAmount(e.target.value)}/></div><div className="between"><span>원화 환산 예상액</span><b>{formatKrw(amountValue*stableRate)}</b></div><div className="limit-box">1회 기업 외환 송금 잔여 한도 <b>40,000.00 USD</b><div className="progress"><i style={{width:"70%"}}/></div><small>한도 소진율 70.0% · 정상 승인 대상</small></div></section></div><aside className="side-stack"><section className="panel form-panel"><h2>Yahoo Finance USD/KRW 시세</h2><small>USD / KRW · 60초 자동 갱신</small><div className="rate">{formatRate(referenceRate)} <small>원</small></div><b className={rateChangeClass}>{rateChangeLabel}</b><small>{rateTimeLabel}</small><small className="fx-disclaimer">{fxQuote?"참고 시세 · 은행 고시 환율과 다를 수 있습니다.":fxError?"Yahoo Finance 연결 실패 · 임시 기준값을 표시합니다.":"Yahoo Finance 시세를 조회하고 있습니다."}</small></section><section className="panel form-panel"><h2>기업 송금 사전 체크리스트</h2>{["외환관리법 사전신고 대상 여부","수취국 규제 & OFAC 스크리닝","당일 정산 마감시한 (16:30)"].map(x=><div className="check" key={x}><CheckCircle2 size={15}/><span>{x}</span><small>확인 완료</small></div>)}</section></aside></div><div className="actions"><Btn kind="ghost" onClick={()=>notify("임시 저장되었습니다.")}>임시저장</Btn><Btn onClick={()=>go("dashboard")}>작성 취소</Btn><Btn kind="primary" onClick={()=>beneficiary.trim()&&amount.trim()?go("method"):notify("필수 항목을 확인해 주세요.")}>다음: 조건 확인 →</Btn></div></>}
 {page==="method"&&<><div className="workflow-head"><Heading title="송금 방식 및 실행조건 확인" crumb="해외송금 신청"/><Steps active={2}/></div><section className="panel recipient"><div><small>송금 대상 기업</small><b>ACME TRADING CORP (US)</b><span>JP Morgan Chase NY (021000021)</span></div><div><small>지급 확정 청구액</small><b className="large">{amount} USD</b><span>수취인 지정 실수령액 전액 보장</span></div><div><small>출금 원화계좌</small><b>148-910024-81704</b><span>하나은행 보통예금 (주)한빛무역</span></div></section><div className="compare"><div><h2>송금 방식 실시간 비교 및 선택</h2><small>● Yahoo Finance 참고 시세 연동 (60초 자동 갱신)</small></div><span>견적 유효시간 <b>02:30</b></span></div><div className="method-grid"><button className={method==="stable"?"method chosen":"method"} onClick={()=>setMethod("stable")}><Zap/><Tag tone="green">추천</Tag><small>스테이블코인 은행간 원장망</small><h3>USDC 기반 송금</h3><strong>{usdAmountLabel} USD</strong><hr/><p>적용 환율 <b>{formatRate(stableRate)} KRW</b></p><p>총 송금 수수료 <b>중계·수취 수수료 면제</b></p><p>예상 도달 소요시간 <b>당일 완료</b></p><small>약 45분 이내 입금</small></button><button className={method==="swift"?"method chosen":"method"} onClick={()=>setMethod("swift")}><Landmark/><small>기존 국제은행간 통신망</small><h3>기존 SWIFT 전신환망</h3><strong>{usdAmountLabel} USD</strong><hr/><p>적용 환율 <b>{formatRate(swiftRate)} KRW</b></p><p>총 송금 수수료 <b>전신료 + 중계료 $25</b></p><p>예상 도달 소요시간 <b>1 ~ 3 영업일</b></p><small>미국 현지 결제원 개장 후</small></button></div><div className="workflow-grid summary-grid"><section className="panel form-panel"><h2>확정 송금 견적서</h2>{[["선택 방식",method==="stable"?"스테이블코인 송금 (USDC)":"기존 SWIFT 전신환망"],["지급 외화 수량",`${usdAmountLabel} USD`],["적용 환율",`${formatRate(selectedRate)} KRW/USD`],["환산 원화 금액",formatKrw(amountValue*selectedRate)],["송금 처리 수수료",formatKrw(selectedFee)]].map(x=><div className="summary-row" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}<div className="total">최종 출금 예정 총액 <b>{formatKrw(selectedTotal)}</b></div></section><section className="panel form-panel"><h2>선택 시 참고사항</h2><p>빠른 정산</p><small>스테이블코인 방식은 네트워크 상태에 따라 빠르게 처리될 수 있습니다.</small><p>규정 준수</p><small>두 방식 모두 수취인 확인 및 외환 규정 검토 절차를 거칩니다.</small></section></div><div className="actions"><Btn kind="ghost" onClick={()=>go("input")}><ArrowLeft size={14}/> 이전 단계</Btn><Btn onClick={()=>notify("임시 저장되었습니다.")}>임시저장</Btn><Btn kind="primary" onClick={()=>go("evidence")}>다음: 증빙 첨부 →</Btn></div></>}
 {page==="evidence"&&<><div className="workflow-head"><Heading title="증빙자료 첨부 및 전자결재 상신" crumb="해외송금 신청"/><Steps active={3}/></div><div className="meta">거래 관리번호 <b>FX-20260330-8841A</b> <Tag tone="blue">STEP 03 / FINAL</Tag></div><div className="workflow-grid"><div className="forms"><section className="panel form-panel"><h2>필수 무역거래 증빙서류</h2><small>외환검증 자동분석 · 외국환거래법 제18조 및 대외무역법 관련 규정 준수</small>{["상업송장 (Commercial Invoice)","선하증권 (B/L) 또는 항공운송장","기타 무역계약서 / 견적서 (P/I)"].map((d,i)=><div className="document" key={d}><FileText/><div><b>{i+1}) {d}</b><small>{docs.includes(d)?"검증 완료":"PDF, JPG, PNG 파일을 첨부해 주세요."}</small></div>{docs.includes(d)?<Btn kind="ghost" onClick={()=>setDocs(docs.filter(x=>x!==d))}>삭제</Btn>:<label className="upload">파일 선택<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>{if(e.currentTarget.files?.[0]){setDocs([...docs,d]);notify("증빙자료가 등록되었습니다.")}}}/></label>}</div>)}<div className="drop"><UploadCloud/><b>증빙서류를 이 영역으로 끌어다 놓으세요</b><small>PDF, JPG, PNG · 파일당 최대 20MB</small></div></section><section className="panel form-panel"><div className="between"><h2>기안자 결재 코멘트</h2><small>{comment.length}/200자</small></div><textarea className="comment-textarea" value={comment} maxLength={200} onChange={e=>setComment(e.target.value)}/></section><section className="panel form-panel"><h2>전자결재선 지정 · 2단계 전결</h2>{[["기안","홍길동 대리","재무관리부 / 마스터"],["1차","이팀장 (팀장)","재무기획팀"],["2차","김대표 (대표이사)","경영총괄"]].map((x,i)=><div className="approver" key={x[0]}><b className="approver-step">{x[0]}</b><span><strong>{x[1]}</strong><small>{x[2]}</small></span><Tag tone={i===0?"green":"slate"}>{i===0?"작성중":"대기예정"}</Tag></div>)}</section></div><aside className="panel form-panel"><h2>최종 송금 신청 요약</h2>{[["수취기관","PACIFIC EDGE TECH INC"],["적용 기준 환율",`${formatRate(selectedRate)} KRW / USD`],["최종 결제 금액",`${usdAmountLabel}`],["원화 출금 예정액",formatKrw(selectedTotal)]].map(x=><div className="summary-row" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}<Tag tone="green">출금계좌 잔액 충분</Tag></aside></div><div className="actions"><Btn kind="ghost" onClick={()=>go("method")}>← 조건 수정</Btn><Btn onClick={()=>notify("임시 저장되었습니다.")}>임시저장</Btn><Btn kind="primary" onClick={()=>{if(!docs.includes("상업송장 (Commercial Invoice)")||!docs.includes("선하증권 (B/L)")){notify("필수 증빙서류 2건을 첨부해 주세요.");return}go("approvals");notify("전자결재 상신이 완료되었습니다.")}}>전자결재 상신 →</Btn></div></>}
 {page==="approvals"&&<><div className="page-head"><Heading title="승인관리" crumb="해외송금 결재 센터"/><Btn onClick={()=>notify("결재 목록을 새로고침했습니다.")}><RefreshCw size={14}/> 새로고침</Btn></div><div className="metrics three"><Metric label="결재진행" value="2" note="검토 및 승인 중" icon={Clock3}/><Metric label="완료함" value="48" note="이번 달 누적" icon={CheckCircle2}/><Metric label="미결함" value="3" note="결재자 확인 필요" icon={AlertTriangle}/></div><section className="panel form-panel filter-panel"><div className="field-row"><Field label="조회 시작일"><input type="date" defaultValue="2026-10-21"/></Field><Field label="조회 종료일"><input type="date" defaultValue="2026-10-28"/></Field><Field label="기안자"><input defaultValue="홍길동 대리"/></Field><Field label="거래번호"><input placeholder="RM-20261028"/></Field><Btn onClick={()=>notify("조건에 맞는 결재 건을 조회했습니다.")}>검색조회</Btn></div><p>총 미결 건수: <b>3건</b>　합산 금액: <b>$65,400.00 USD</b>　정렬순서: 긴급 / 등록일순</p></section><div className="approval-grid"><section className="panel"><div className="panel-head"><b>결재 대기 목록</b><Filter size={16}/></div>{txs.slice(0,3).map(x=><button className={"approval-item "+(selected.id===x.id?"selected":"")} key={x.id} onClick={()=>setSelected(x)}><b>{x.id}</b><span>{x.name}</span><small>{x.date} · USD {x.amount}</small><Tag tone={x.tone}>{x.state}</Tag></button>)}</section><section className="panel form-panel"><h2>외환송금 결재 상세 검토</h2><small>참조번호: {selected.id}</small><h3>1. 송금 및 정산 개요</h3>{[["출금 계좌","하나은행 102-910024-88401"],["출금 예정액","43,875,000 KRW"],["적용 환율","1,350.00 KRW / USD"],["수취 외화액","USD "+selected.amount],["수취인 (기업)",selected.name],["수취 블록체인 지갑","0x83F41b802aCd417B696b99C6A2840D048"]].map(x=><div className="summary-row" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}<h3>2. 증빙서류</h3><div className="document"><FileText/><b>상업송장 · 청구액 일치</b><Btn kind="ghost" onClick={()=>notify("문서 미리보기는 데모입니다.")}>열람</Btn></div><div className="document"><FileText/><b>선하증권 · 입항 완료</b><Btn kind="ghost" onClick={()=>notify("문서 미리보기는 데모입니다.")}>열람</Btn></div><div className="actions"><Btn kind="danger" onClick={()=>{setRejectionReason("");setRejectionOpen(true)}}>반려</Btn><Btn kind="primary" onClick={()=>notify("승인 확인 요청을 기록했습니다. 실제 OTP 서명은 연결되어 있지 않습니다.")}>최종 승인 (법인 OTP 전자서명)</Btn></div><small className="muted">데모 화면이며 실제 금융 거래, OTP 서명, 외부 은행 API는 연결되어 있지 않습니다.</small></section></div></>}
 {page==="ledger"&&<><div className="page-head"><Heading title="해외송금 거래내역 및 정산 상태" crumb="외환관리"/><Btn onClick={exportCsv}><Download size={14}/> 엑셀 다운로드 (CSV)</Btn></div><div className="metrics three"><Metric label="당일 송금 집행 총액" value="$134,200.00" note="USD 기준 · 6건 집행중" icon={ArrowUpRight}/><Metric label="KRW 환산 추정액" value="₩185,504,860" note="실시간 환율 기준" icon={Wallet}/><Metric label="결재 및 서류 조치 필요" value="2건" note="결재대기 1건 · 증빙보완 1건" icon={AlertTriangle}/></div><section className="panel form-panel filter-panel"><div className="field-row"><Field label="조회 시작일"><input type="date" defaultValue="2026-10-21"/></Field><Field label="조회 종료일"><input type="date" defaultValue="2026-10-28"/></Field><Field label="처리 상태"><select value={status} onChange={e=>setStatus(e.target.value)}><option>전체 상태</option>{txs.map(x=><option key={x.state}>{x.state}</option>)}</select></Field><Field label="검색어"><div className="search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="거래번호 / 수취기업 / 레일"/></div></Field><Btn kind="primary">조회</Btn></div><div className="currency-tabs">송금 통화　<button className="selected">전체</button><button>USD</button><button>EUR</button><button>JPY</button><button>SGD</button></div></section><section className="panel"><div className="panel-head"><div><b>통합 외환 거래 원장</b><small>조회 결과: {rows.length}건 · 당일 승인 건 우선 정렬</small></div><div className="ledger-tabs"><button className="selected">스테이블코인 정산</button><button>기존 SWIFT 망</button></div></div>{table(rows)}<div className="table-foot">1–{rows.length} / 총 64건 중 표시 <span>페이지 1　2　3　다음 →</span></div></section></>}
 {page==="detail"&&<><div className="page-head"><div><Heading title={"거래 상세 및 정산 상태 ("+selected.id+")"} crumb="외환거래내역"/><small className="live">● 실시간 온체인 감시 활성　|　최종 갱신: 2026-10-28 14:34:12 KST</small></div><Btn onClick={()=>go("ledger")}><ArrowLeft size={14}/> 목록으로 돌아가기</Btn></div><section className="panel pipeline-panel"><div className="panel-head"><div><b>실시간 정산 파이프라인</b><small>Cross-Border Settlement Pipeline · Circle CCTP v2.1 (Polygon-to-DBS Gateway)</small></div><Tag tone="amber">주의 / 지연감지</Tag></div><div className="pipeline">{[["01","신청접수","완료","14:10:02 KST","하나기업뱅킹 전문수신"],["02","전자결재승인","최종인가 완료","14:22:15 KST","대표이사 전자서명 완료"],["03","스마트 컨트랙트","진행중 (지연)","14:25:40 호출됨","온체인 대기시간 8분 경과"],["04","해외파트너정산","대기중","미도달","DBS Trust Liquidity Pool"],["05","수취은행지급","대기중","미도달","수취인 계좌 입금 전"]].map((x,i)=><div className="pipeline-step" key={x[0]}><b className={`step-index ${i<2?"ok":i===2?"warn":""}`}>{i<2?"✓":x[0]}</b><strong>{x[1]}</strong><Tag tone={i<2?"green":i===2?"amber":"slate"}>{x[2]}</Tag><small>{x[3]}</small><small>{x[4]}</small></div>)}</div></section>{incident&&<section className="incident"><div><b>이상 징후 감지: ERR_STABLE_LIQUIDITY_DISRUPTED</b><small>감지 시각: 14:32:05 KST</small><p>수취국 현지 USDC 환산 유동성 공급처의 일시적 정체로 오프램프 전환 지연이 감지되었습니다.</p></div><button onClick={()=>setIncident(false)}><X size={15}/></button></section>}<section className="panel form-panel emergency"><div className="panel-head"><div><b>비상 전환(SWIFT) 조건 심사 및 전환 실행</b><small>지연 발생 시 기존 국제 송금망으로 전환할 수 있도록 조건을 검토합니다.</small></div><Tag tone={swift?"blue":"amber"}>{swift?"전환 검토 중":"조치 필요"}</Tag></div><div className="between"><b>SWIFT 비상 전환 모드</b><button className={"toggle "+(swift?"on":"")} onClick={()=>setSwift(!swift)}><i/></button></div>{swift&&<p className="warning">비상 전환은 승인과 수취인 계좌 재확인 후 실제 업무 시스템에서 실행해야 합니다.</p>}<div className="actions"><Btn onClick={()=>notify("전환 조건을 다시 확인했습니다.")}>조건 재검증</Btn><Btn kind="primary" onClick={()=>notify("데모 상태로 요청을 기록했습니다. 실제 SWIFT 송금은 실행되지 않았습니다.")}>SWIFT 전환 요청</Btn></div></section><div className="detail-grid"><section className="panel form-panel"><h2>송금 기본 정보 및 수취 기업 명세</h2>{[["수취인 상호","Pacific Trade Logistics Ltd."],["수취 국가 / 통화","싱가포르 (SG) / USD"],["수취 은행","DBS Bank Ltd. (Singapore) · DBSSSGSGXXX"],["수취 계좌번호","003-902847-1192-USD"],["송금 사유 구분","일반 상품 수입대금 결제 · 외환코드 101"],["송금인 출금계좌","하나은행 102-910293-84705"]].map(x=><div className="summary-row" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</section><section className="panel form-panel"><h2>정산 결제 비용 분해 명세</h2><small>우대환율 적용: 80% 스프레드 감면</small>{[["송금 계약 외화금액","$32,500.00 USD"],["상응 스테이블코인","32,500.00 USDC · 1:1 Peg"],["매매기준율","1,385.20 KRW/USD"],["원화 환산 원금","44,931,250 KRW"],["기업 외환 송금 수수료","38,000 KRW"]].map(x=><div className="summary-row" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</section></div><div className="detail-grid"><section className="panel form-panel"><h2>제출 증빙 서류 및 AI OCR 대조</h2>{["상업송장 (Commercial Invoice #INV-2026-SG891)","선하증권 (Bill of Lading #HDMU-99021841)"].map(x=><div className="document" key={x}><FileText/><b>{x}</b><Tag tone="green">PDF · 검증 완료</Tag><Btn kind="ghost" onClick={()=>notify("첨부 문서 미리보기는 데모입니다.")}>열람 <Eye size={13}/></Btn></div>)}</section><section className="panel form-panel"><h2>정산 감사 이력 · AUD-881920</h2>{[["14:10:02","기안 접수","홍길동 대리 · 재무관리부"],["14:15:30","1차 내부 결재 승인","이팀장 부서장 · 재무기획팀"],["14:22:15","최종 전자서명 승인","김대표 대표이사"],["14:25:40","컨트랙트 호출 및 온체인 발행","해외송금 정산 엔진"]].map(x=><div className="audit" key={x[0]}><time>{x[0]}</time><span><b>{x[1]}</b><small>{x[2]}</small></span></div>)}</section></div></>}
 </main><footer>© 2026 Hana Business Suite · Foreign Exchange <span>접속 IP: 192.168.1.104　● 암호화 통신 중</span></footer></div>{rejectionOpen&&<div className="reject-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setRejectionOpen(false)}}><form className="reject-modal" role="dialog" aria-modal="true" aria-labelledby="reject-modal-title" onSubmit={e=>{e.preventDefault();if(!rejectionReason.trim())return;setRejectionOpen(false);setRejectionReason("");notify("반려 요청을 확인했습니다. 실제 전자결재 시스템은 연결되어 있지 않습니다.")}}><div className="reject-modal-header"><div className="reject-modal-icon"><AlertTriangle size={20}/></div><button type="button" className="reject-modal-close" aria-label="닫기" onClick={()=>setRejectionOpen(false)}><X size={18}/></button></div><h2 id="reject-modal-title">반려 사유를 입력해 주세요</h2><p className="reject-modal-description">선택한 송금 건을 반려하기 전에 사유를 작성해 주세요.</p><div className="reject-target"><small>반려 대상</small><b>{selected.id}</b><span>{selected.name}</span></div><label className="reject-reason-label" htmlFor="reject-reason">반려 사유 <em>필수</em></label><textarea id="reject-reason" className="reject-reason" value={rejectionReason} maxLength={300} required placeholder="증빙 누락, 송금 정보 불일치 등 반려 사유를 입력해 주세요." onChange={e=>setRejectionReason(e.target.value)}/><div className="reject-character-count">{rejectionReason.length}/300자</div><div className="reject-modal-footer"><button type="button" className="btn" onClick={()=>setRejectionOpen(false)}>취소</button><button type="submit" className="btn danger reject-confirm" disabled={!rejectionReason.trim()}>반려 확정</button></div><p className="reject-demo-note">데모 화면입니다. 실제 전자결재 상태나 거래 데이터는 변경되지 않습니다.</p></form></div>}{toast&&<div className="toast"><CheckCircle2 size={16}/>{toast}</div>}</div>
}
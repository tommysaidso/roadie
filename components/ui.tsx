import React from "react";
export function Page({title,sub,children,actions}:{title:string;sub?:string;children:React.ReactNode;actions?:React.ReactNode;}){
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">{title}</h1>
          {sub && <p className="text-muted mt-1 max-w-2xl">{sub}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
export function Stat({label,value,hint}:{label:string;value:React.ReactNode;hint?:string;}){
  return (<div className="card p-4"><div className="label">{label}</div><div className="text-2xl font-bold mt-1">{value}</div>{hint&&<div className="text-xs text-muted mt-1">{hint}</div>}</div>);
}
export function Tag({children}:{children:React.ReactNode}){ return <span className="pill mr-1 mb-1 inline-block">{children}</span>; }

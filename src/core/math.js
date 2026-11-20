export const mean = (xs) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : NaN;

export function variance(xs, sample = true) {
  if (xs.length < (sample ? 2 : 1)) return NaN;
  const m = mean(xs);
  const ss = xs.reduce((s,x)=>s + (x-m) ** 2, 0);
  return ss / (xs.length - (sample ? 1 : 0));
}

export const sd = (xs, sample = true) => Math.sqrt(variance(xs, sample));

export function quantile(xs, q) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a,b)=>a-b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export const transpose = (A) => A[0].map((_,j)=>A.map(r=>r[j]));

export function matMul(A, B) {
  const BT = transpose(B);
  return A.map(row => BT.map(col => row.reduce((s,v,i)=>s + v*col[i],0)));
}

export function matVec(A, x) {
  return A.map(row => row.reduce((s,v,i)=>s + v*x[i],0));
}

export function identity(n) {
  return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
}

export function inverse(A) {
  const n = A.length;
  const aug = A.map((r,i)=>[...r, ...identity(n)[i]]);
  for (let c=0;c<n;c++) {
    let p=c;
    for (let r=c+1;r<n;r++) if (Math.abs(aug[r][c]) > Math.abs(aug[p][c])) p=r;
    if (Math.abs(aug[p][c]) < 1e-12) throw new Error("Singular matrix");
    [aug[c],aug[p]]=[aug[p],aug[c]];
    const pivot=aug[c][c];
    aug[c]=aug[c].map(v=>v/pivot);
    for (let r=0;r<n;r++) {
      if (r===c) continue;
      const f=aug[r][c];
      aug[r]=aug[r].map((v,j)=>v-f*aug[c][j]);
    }
  }
  return aug.map(r=>r.slice(n));
}

export function addDiagonal(A, lambda, skipFirst=false) {
  return A.map((row,i)=>row.map((v,j)=>i===j && !(skipFirst && i===0) ? v+lambda : v));
}

export function jacobiEigen(input, maxIter=150, tol=1e-10) {
  const A=input.map(r=>[...r]);
  const n=A.length;
  const V=identity(n);
  for (let iter=0;iter<maxIter;iter++) {
    let p=0,q=1,max=0;
    for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) {
      const a=Math.abs(A[i][j]);
      if (a>max) { max=a; p=i; q=j; }
    }
    if (max<tol) break;
    const phi=0.5*Math.atan2(2*A[p][q], A[q][q]-A[p][p]);
    const c=Math.cos(phi), s=Math.sin(phi);
    const app=A[p][p], aqq=A[q][q], apq=A[p][q];
    A[p][p]=c*c*app - 2*s*c*apq + s*s*aqq;
    A[q][q]=s*s*app + 2*s*c*apq + c*c*aqq;
    A[p][q]=A[q][p]=0;
    for (let k=0;k<n;k++) {
      if (k!==p && k!==q) {
        const aik=A[k][p], akq=A[k][q];
        A[k][p]=A[p][k]=c*aik - s*akq;
        A[k][q]=A[q][k]=s*aik + c*akq;
      }
      const vip=V[k][p], viq=V[k][q];
      V[k][p]=c*vip - s*viq;
      V[k][q]=s*vip + c*viq;
    }
  }
  return { values:A.map((r,i)=>r[i]), vectors:V };
}

import type {LoaderFunctionArgs} from 'react-router';
import {redirect,Form} from 'react-router';
import styles from './styles.module.css';
export const loader=async({request}:LoaderFunctionArgs)=>{const url=new URL(request.url);if(url.searchParams.get('shop'))throw redirect(`/app?${url.searchParams}`);return null;};
export default function App(){return <div className={styles.index}><div className={styles.content}><h1 className={styles.heading}>No Sweat SEO Studio</h1><p className={styles.text}>No Sweat USA için Shopify içinde SEO denetimi, toplu düzenleme ve değişiklik geçmişi.</p><Form className={styles.form} method="post" action="/auth/login"><input type="hidden" name="shop" value="iyhxfe-mw.myshopify.com"/><button className={styles.button} type="submit">Shopify ile giriş yap</button></Form><p>Uygulama mağazaya yüklendikten sonra Shopify → Uygulamalar bölümünden açılır.</p></div></div>;}

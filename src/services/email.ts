import {Resend} from "resend"
import { success } from "zod"

interface sendEmailProps  {
    to:string,
    subject:string,
    html:string,
    env:any
}




export async function sendEmail({to , subject , html,env}:sendEmailProps){
    try{
      const resend = new Resend(env.RESEND_API_KEY)
      const DOMAIN = env.RESEND_DOMAIN

      const {data , error} = await resend.emails.send({
        from:`no-reply ${DOMAIN}`,
        to,
        subject,
        html
      })

      if (error){
        console.error(`Resend Error: Code: ${error.statusCode}`)
        return {success:false , error : error.message}
      }

      return {success:true , data}
    }catch(err){
       console.error(`Resend System Crash: ${err}`)
       return {success:false, error:err instanceof Error ? err.message : "Unknown error"}
    }
}

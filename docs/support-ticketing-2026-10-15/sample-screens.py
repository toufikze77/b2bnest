import asyncio, json, base64, time, re
from playwright.async_api import async_playwright
ORG="0a000000-0000-4000-8000-000000000001"; STAFF="5a000000-0000-4000-8000-000000000001"; CUST="c0000000-0000-4000-8000-000000000001"
T1="71000000-0000-4000-8000-000000000001"; T2="71000000-0000-4000-8000-000000000002"
def jwt(sub,email):
  b=lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
  return b({"alg":"HS256","typ":"JWT"})+"."+b({"sub":sub,"email":email,"exp":int(time.time())+36000,"role":"authenticated","aud":"authenticated"})+".x"
def session(sub,email):
  u={"id":sub,"email":email,"aud":"authenticated","role":"authenticated","email_confirmed_at":"2026-10-01T00:00:00Z","app_metadata":{},"user_metadata":{"full_name":"SAMPLE "+email},"created_at":"2026-10-01T00:00:00Z"}
  return {"access_token":jwt(sub,email),"refresh_token":"r","token_type":"bearer","expires_in":36000,"expires_at":int(time.time())+36000,"user":u},u
now="2026-10-15T09:00:00Z"
tickets=[{"id":T1,"organization_id":ORG,"reference":"T-00001","subject":"SAMPLE: Printer offline in reception","description":"SAMPLE DATA. The reception printer shows offline since this morning.","category_id":"ca1","priority":"high","status":"open","requester_id":CUST,"assignee_id":STAFF,"created_at":now,"updated_at":now},
 {"id":T2,"organization_id":ORG,"reference":"T-00002","subject":"SAMPLE: VPN keeps disconnecting","description":"SAMPLE DATA.","category_id":None,"priority":"medium","status":"waiting_customer","requester_id":"c2","assignee_id":None,"created_at":now,"updated_at":now}]
msgs=[{"id":"m1","author_id":STAFF,"body":"PRIVATE NOTE (sample): toner sensor fault last month too.","is_internal":True,"created_at":now},
 {"id":"m2","author_id":STAFF,"body":"Hi, we're looking at it now. Could you restart the printer?","is_internal":False,"created_at":now},
 {"id":"m3","author_id":CUST,"body":"Restarted, still offline.","is_internal":False,"created_at":now}]
atts=[{"id":"a1","message_id":None,"storage_path":f"{ORG}/{T1}/x-photo.png","file_name":"printer-photo.png","size_bytes":204800,"is_internal":False},
 {"id":"a2","message_id":"m1","storage_path":f"{ORG}/{T1}/y-log.txt","file_name":"internal-log.txt","size_bytes":2048,"is_internal":True}]
settings={"organization_id":ORG,"support_name":"SAMPLE Support Desk","logo_url":None,"support_hours":None,"time_zone":None,"portal_enabled":True}
def make_handler(role,user):
  async def h(route):
    req=route.request; url=req.url; obj="vnd.pgrst.object" in (req.headers.get("accept") or "")
    def ok(d,status=200): return route.fulfill(status=status,content_type="application/json",body=json.dumps(d))
    if "/auth/v1/user" in url: return await ok(user)
    if "/auth/v1/" in url: return await ok({})
    staff=role=="staff"
    if "/rest/v1/rpc/support_claim_invitations" in url: return await ok(0)
    if "/rest/v1/rpc/get_user_display_info" in url:
      b=json.loads(req.post_data or "{}"); n={STAFF:"SAMPLE Owner Olivia","b0000000-0000-4000-8000-000000000001":"SAMPLE Ben (member)","b0000000-0000-4000-8000-000000000002":"SAMPLE Amira (agent)"}.get(b.get("p_user_id"),"SAMPLE")
      return await ok([{"id":b.get("p_user_id"),"display_name":n,"avatar_url":None,"headline":None}])
    m=re.search(r"/rest/v1/([a-z_]+)",url); t=m.group(1) if m else ""
    data=None
    if t=="organization_members":
      if "select=user_id" in url and "role" in url and "organizations" not in url:
        data=[{"user_id":STAFF,"role":"owner"},{"user_id":"b0000000-0000-4000-8000-000000000001","role":"member"},{"user_id":"b0000000-0000-4000-8000-000000000002","role":"member"}] if staff else []
      else:
        data=[{"organization_id":ORG,"role":"owner","organizations":{"id":ORG,"name":"SAMPLE Telecom Ltd"}}] if staff else []
    elif t=="support_settings": data=settings
    elif t=="support_tickets":
      mine=[x for x in tickets if staff or x["requester_id"]==CUST]
      idm=re.search(r"[?&]id=eq\.([0-9a-f-]+)",url)
      data=[x for x in mine if not idm or x["id"]==idm.group(1)]
      if obj: data=data[0] if data else None
    elif t=="support_messages": data=[x for x in msgs if staff or not x["is_internal"]]
    elif t=="support_attachments": data=[x for x in atts if staff or not x["is_internal"]]
    elif t=="support_categories": data=[{"id":"ca1","name":"Printers","archived_at":None},{"id":"ca2","name":"Email","archived_at":None}]
    elif t=="support_agents": data=[{"user_id":"b0000000-0000-4000-8000-000000000002"}]
    elif t=="support_customers": data=[{"id":"sc1","email":"customer@sample.test","display_name":None,"client_name":"SAMPLE Clinic","user_id":CUST,"revoked_at":None,"expires_at":now,"organization_id":ORG}] if staff else [{"organization_id":ORG}]
    else: data=None if obj else []
    if obj and data is None: return await ok({"code":"PGRST116","message":"none"},406)
    return await ok(data)
  return h
async def shot(b, role, sub, email, path, name, w, h, clicks=()):
  ctx=await b.new_context(viewport={"width":w,"height":h}); pg=await ctx.new_page()
  s,u=session(sub,email); await pg.route(re.compile(r".*gvftvswyrevummbvyhxa\.supabase\.co.*"), make_handler(role,u))
  await pg.goto("http://localhost:8080/"); await pg.evaluate(f"localStorage.setItem('sb-gvftvswyrevummbvyhxa-auth-token', {json.dumps(json.dumps(s))}); localStorage.setItem('activeOrganizationId','{ORG}')")
  0 and pg.on("console", lambda m: print("CONSOLE", m.text[:200]) if m.type=="error" else None); 0 and pg.on("response", lambda r: print("RESP", r.status, r.url[:140]) if "support_" in r.url else None)
  await pg.goto("http://localhost:8080"+path); await pg.wait_for_timeout(3500)
  for c in clicks: await pg.get_by_role(c[0], name=c[1]).first.click(); await pg.wait_for_timeout(1500)
  await pg.screenshot(path=f"/tmp/browser/sup2/{name}.png"); print(name, pg.url); await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True)
    await shot(b,"staff",STAFF,"owner@sample.test",f"/support-desk?ticket={T1}","staff_desktop",1440,1000)
    await shot(b,"staff",STAFF,"owner@sample.test","/support-desk","staff_setup",1440,1400,[("tab","Setup & access")])
    await shot(b,"cust",CUST,"customer@sample.test",f"/support/portal?ticket={T1}","customer_desktop",1280,1000)
    await shot(b,"staff",STAFF,"owner@sample.test",f"/support-desk?ticket={T1}","staff_mobile",390,844)
    await shot(b,"cust",CUST,"customer@sample.test","/support/portal","customer_mobile",390,844)
    await b.close()
asyncio.run(main())

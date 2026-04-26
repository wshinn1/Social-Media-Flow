export async function fetchFacebookLead(leadgenId: string) {
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageToken) {
    console.error("FB_PAGE_ACCESS_TOKEN is not set");
    return null;
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${pageToken}`
  );

  if (!res.ok) {
    console.error("Facebook Graph API error", await res.text());
    return null;
  }

  const data = await res.json();
  const fields: Record<string, string> = {};

  console.log("Facebook lead raw field_data:", JSON.stringify(data.field_data));

  for (const field of data.field_data ?? []) {
    fields[field.name] = field.values?.[0] ?? "";
  }

  // Facebook forms use full_name, name, or separate first_name/last_name
  const fullName = fields["full_name"] ?? fields["name"] ?? "";
  const firstName = fields["first_name"] || (fullName ? fullName.split(" ")[0] : "");
  const lastName = fields["last_name"] || (fullName ? fullName.split(" ").slice(1).join(" ") : "");

  return {
    first_name: firstName,
    last_name: lastName,
    email: fields["email"] ?? "",
    phone: fields["phone_number"] ?? "",
    appointment_date: fields["appointment_scheduled_time"] ?? fields["date"] ?? "",
    budget: fields["budget"] ?? fields["what_is_your_budget_"] ?? "",
  };
}

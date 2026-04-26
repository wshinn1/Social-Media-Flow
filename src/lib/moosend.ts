const MOOSEND_API_KEY = process.env.MOOSEND_API_KEY!;
const MOOSEND_MAILING_LIST_ID = process.env.MOOSEND_MAILING_LIST_ID!;

interface MoosendSubscriber {
  Email: string;
  Name: string;
  CustomFields?: string[];
}

export async function addSubscriberToMoosend(data: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  budget: string;
  appointmentDate: string;
}): Promise<{ success: boolean; error?: string }> {
  const customFields = [
    data.phone ? `Phone=${data.phone}` : null,
    data.budget ? `Budget=${data.budget}` : null,
    data.appointmentDate ? `AppointmentDate=${data.appointmentDate}` : null,
  ].filter((f): f is string => f !== null);

  const subscriber: MoosendSubscriber = {
    Email: data.email,
    Name: `${data.firstName} ${data.lastName}`.trim(),
    ...(customFields.length > 0 && { CustomFields: customFields }),
  };

  if (!MOOSEND_API_KEY || !MOOSEND_MAILING_LIST_ID) {
    console.error("Moosend not configured: MOOSEND_API_KEY or MOOSEND_MAILING_LIST_ID missing");
    return { success: false, error: "Moosend not configured" };
  }

  try {
    const res = await fetch(
      `https://api.moosend.com/v3/subscribers/${MOOSEND_MAILING_LIST_ID}/subscribe.json?apikey=${MOOSEND_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Subscribers: [subscriber] }),
      }
    );

    const json = await res.json();

    if (!res.ok || json.Code !== 0) {
      console.error(
        `Moosend API error — HTTP ${res.status}, Code ${json.Code}, Error: ${json.Error}`,
        JSON.stringify(json)
      );
      return {
        success: false,
        error: json.Error || `Moosend API error (HTTP ${res.status}, Code ${json.Code})`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("Moosend fetch exception:", err);
    return { success: false, error: String(err) };
  }
}

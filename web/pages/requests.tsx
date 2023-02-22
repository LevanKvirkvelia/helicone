import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { GetServerSidePropsContext } from "next";
import AuthHeader from "../components/shared/authHeader";
import AuthLayout from "../components/shared/layout/authLayout";
import MetaData from "../components/shared/metaData";
import RequestsPage from "../components/templates/requests/requestsPage";
import { getProperties } from "../lib/api/properties/properties";
import { unwrapAsync } from "../lib/result";
import StickyHeadTable from "../components/test";
import { getRequests, ResponseAndRequest } from "../services/lib/requests";
import { getPromptValues } from "../lib/api/prompts/prompts";

interface RequestsProps {
  user: any;
  error: string | null;
  data: ResponseAndRequest[];
  count: number | null;
  page: number;
  pageSize: number;
  from: number;
  to: number;
  sortBy: string | null;
  properties: string[];
  timeFilter: string | null;
  values: string[];
}

const Requests = (props: RequestsProps) => {
  const {
    user,
    data,
    error,
    count,
    page,
    pageSize,
    from,
    to,
    properties,
    sortBy,
    timeFilter,
    values,
  } = props;

  return (
    <MetaData title="Requests">
      <AuthLayout user={user}>
        <RequestsPage
          requests={data}
          error={error}
          count={count}
          page={page}
          pageSize={pageSize}
          from={from}
          to={to}
          sortBy={sortBy}
          timeFilter={timeFilter}
          properties={properties}
          values={values}
        />
      </AuthLayout>
    </MetaData>
  );
};

export default Requests;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const supabase = createServerSupabaseClient(context);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session)
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };

  const { page, page_size, sort, time } = context.query;

  const currentPage = parseInt(page as string, 10) || 1;
  const pageSize = parseInt(page_size as string, 10) || 5;
  const sortBy = (sort as string) || null;
  const timeFilter = (time as string) || null;

  const { data, error, count, from, to } = await getRequests(
    supabase,
    currentPage,
    pageSize,
    sortBy,
    timeFilter
  );

  let allProperties: string[] = [];
  try {
    allProperties = (await unwrapAsync(getProperties(session.user.id))).map(
      (property) => {
        return property.property;
      }
    );
  } catch (err) {
    console.error(err);
    allProperties = [];
  }

  let allValues: string[] = [];
  try {
    allValues = (await unwrapAsync(getPromptValues(session.user.id))).map(
      (value) => {
        return value.value;
      }
    );
  } catch (err) {
    console.error(err);
    allValues = [];
  }

  return {
    props: {
      initialSession: session,
      user: session.user,
      error: error?.message || null,
      data: (data as ResponseAndRequest[]) || [],
      count: count,
      page: currentPage,
      pageSize: pageSize,
      from: from,
      to: to,
      sortBy: sortBy,
      timeFilter: timeFilter,
      properties: allProperties,
      values: allValues,
    },
  };
};
